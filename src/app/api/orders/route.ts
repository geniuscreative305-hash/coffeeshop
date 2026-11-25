import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { eq, sql, like, desc } from "drizzle-orm";
import {
  db,
  orders,
  products,
  categories,
  vouchers,
  type OrderItemJson,
} from "@/db";
import { getJakartaDateKey } from "@/lib/format";

const orderItemSchema = z.object({
  product_id: z.number().int().positive(),
  qty: z.number().int().min(1).max(99),
  selected_variants: z
    .array(
      z.object({
        group_name: z.string(),
        option_name: z.string(),
        additional_price: z.number().int().min(0),
      })
    )
    .default([]),
});

const createOrderSchema = z.object({
  customer_name: z.string().trim().min(2, "Nama pelanggan minimal 2 karakter").max(120),
  customer_phone: z.string().trim().min(8, "Nomor WhatsApp tidak valid").max(30),
  order_type: z.enum(["Dine-In", "Pickup", "Delivery"]),
  table_number: z.string().trim().max(32).nullable().optional(),
  payment_method: z.enum(["Cash", "QRIS", "Transfer"]),
  voucher_code: z.string().trim().max(64).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  items: z.array(orderItemSchema).min(1, "Keranjang tidak boleh kosong"),
});

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = createOrderSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Data pesanan tidak valid." },
        { status: 400 }
      );
    }

    const input = parsed.data;
    if (input.order_type === "Dine-In" && !input.table_number) {
      return NextResponse.json(
        { error: "Nomor meja wajib diisi untuk pesanan Dine-In." },
        { status: 400 }
      );
    }

    const dateKey = getJakartaDateKey(new Date());
    const prefix = `ORD-${dateKey}-`;

    const createdOrder = await db.transaction(async (tx) => {
      // 1. Fetch categories map
      const allCats = await tx.select().from(categories);
      const catNameMap = new Map(allCats.map((c) => [c.id, c.name]));

      // 2. Aggregate requested qty per product_id for atomic stock checking
      const qtyByProduct = new Map<number, number>();
      for (const item of input.items) {
        qtyByProduct.set(item.product_id, (qtyByProduct.get(item.product_id) ?? 0) + item.qty);
      }

      const productMap = new Map<
        number,
        {
          id: number;
          name: string;
          categoryId: number;
          price: number;
          discountPrice: number | null;
          isLimitedStock: boolean;
          remainingStock: number;
          isAvailable: boolean;
        }
      >();

      // Lock & verify each unique product row
      for (const [productId, requestedQty] of qtyByProduct.entries()) {
        const lockedResult = await tx.execute(
          sql`SELECT id, name, category_id, price, discount_price, is_limited_stock, remaining_stock, is_available FROM products WHERE id = ${productId} FOR UPDATE`
        );
        const row = lockedResult.rows[0] as
          | {
              id: number;
              name: string;
              category_id: number;
              price: number;
              discount_price: number | null;
              is_limited_stock: boolean;
              remaining_stock: number;
              is_available: boolean;
            }
          | undefined;

        if (!row) {
          throw new Error(`Produk dengan ID ${productId} tidak ditemukan.`);
        }
        if (!row.is_available) {
          throw new Error(`Menu "${row.name}" sedang tidak tersedia.`);
        }
        if (row.is_limited_stock && row.remaining_stock < requestedQty) {
          throw new Error(
            row.remaining_stock <= 0
              ? `Maaf, stok "${row.name}" baru saja habis.`
              : `Stok "${row.name}" hanya tersisa ${row.remaining_stock} porsi.`
          );
        }

        if (row.is_limited_stock) {
          await tx
            .update(products)
            .set({ remainingStock: row.remaining_stock - requestedQty })
            .where(eq(products.id, productId));
        }

        productMap.set(productId, {
          id: row.id,
          name: row.name,
          categoryId: row.category_id,
          price: row.price,
          discountPrice: row.discount_price,
          isLimitedStock: row.is_limited_stock,
          remainingStock: row.remaining_stock,
          isAvailable: row.is_available,
        });
      }

      // 3. Build authoritative items_json & subtotal
      let subtotal = 0;
      const itemsJson: OrderItemJson[] = input.items.map((item) => {
        const prod = productMap.get(item.product_id)!;
        const basePrice = prod.discountPrice ?? prod.price;
        const variantsExtra = item.selected_variants.reduce(
          (sum, v) => sum + v.additional_price,
          0
        );
        const unitTotal = basePrice + variantsExtra;
        const itemTotal = unitTotal * item.qty;
        subtotal += itemTotal;

        return {
          product_id: prod.id,
          name: prod.name,
          category_name: catNameMap.get(prod.categoryId) ?? "Menu",
          qty: item.qty,
          base_price: basePrice,
          selected_variants: item.selected_variants,
          item_total: itemTotal,
        };
      });

      // 4. Re-validate voucher inside transaction & increment used_count
      let appliedVoucherCode: string | null = null;
      let discountAmount = 0;

      if (input.voucher_code && input.voucher_code.trim() !== "") {
        const upperCode = input.voucher_code.trim().toUpperCase();
        const lockedVoucher = await tx.execute(
          sql`SELECT * FROM vouchers WHERE code = ${upperCode} FOR UPDATE`
        );
        const vRow = lockedVoucher.rows[0] as
          | {
              id: number;
              code: string;
              discount_type: "percentage" | "fixed";
              discount_value: number;
              min_order_amount: number;
              max_discount_amount: number | null;
              usage_limit: number | null;
              used_count: number;
              valid_from: Date;
              valid_until: Date;
              is_active: boolean;
            }
          | undefined;

        if (!vRow || !vRow.is_active) {
          throw new Error("Voucher tidak valid atau sudah tidak aktif.");
        }
        const now = new Date();
        if (now < new Date(vRow.valid_from) || now > new Date(vRow.valid_until)) {
          throw new Error("Voucher sudah kedaluwarsa.");
        }
        if (vRow.usage_limit !== null && vRow.used_count >= vRow.usage_limit) {
          throw new Error("Kuota penggunaan voucher telah habis.");
        }
        if (subtotal < vRow.min_order_amount) {
          throw new Error(
            `Minimal belanja untuk voucher ${vRow.code} adalah Rp ${vRow.min_order_amount.toLocaleString("id-ID")}.`
          );
        }

        if (vRow.discount_type === "percentage") {
          discountAmount = Math.floor((subtotal * vRow.discount_value) / 100);
          if (vRow.max_discount_amount !== null && discountAmount > vRow.max_discount_amount) {
            discountAmount = vRow.max_discount_amount;
          }
        } else {
          discountAmount = vRow.discount_value;
        }
        discountAmount = Math.min(discountAmount, subtotal);
        appliedVoucherCode = vRow.code;

        await tx
          .update(vouchers)
          .set({ usedCount: vRow.used_count + 1 })
          .where(eq(vouchers.id, vRow.id));
      }

      const totalAmount = Math.max(0, subtotal - discountAmount);

      // 5. Sequential daily order_code (MAX + 1)
      const latestOrder = await tx
        .select({ orderCode: orders.orderCode })
        .from(orders)
        .where(like(orders.orderCode, `${prefix}%`))
        .orderBy(desc(orders.orderCode))
        .limit(1);

      let nextSeq = 1;
      if (latestOrder.length > 0) {
        const lastPart = latestOrder[0].orderCode.slice(prefix.length);
        const parsedSeq = parseInt(lastPart, 10);
        if (!Number.isNaN(parsedSeq)) {
          nextSeq = parsedSeq + 1;
        }
      }
      const orderCode = `${prefix}${String(nextSeq).padStart(4, "0")}`;

      // 6. Insert order
      const [inserted] = await tx
        .insert(orders)
        .values({
          orderCode,
          customerName: input.customer_name,
          customerPhone: input.customer_phone,
          orderType: input.order_type,
          tableNumber: input.order_type === "Dine-In" ? input.table_number ?? null : null,
          itemsJson,
          subtotal,
          voucherCode: appliedVoucherCode,
          discountAmount,
          totalAmount,
          paymentMethod: input.payment_method,
          orderStatus: "Pending",
          notes: input.notes || null,
        })
        .returning();

      return inserted;
    });

    revalidateTag("catalog");
    return NextResponse.json({ order: createdOrder }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memproses pesanan.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
