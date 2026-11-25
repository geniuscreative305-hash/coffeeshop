import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db, orders, products, auditLogs } from "@/db";
import { getAdminSession } from "@/lib/auth";

const ALLOWED_STATUSES = ["Pending", "Brewing", "Ready", "Completed", "Cancelled"] as const;
type OrderStatus = (typeof ALLOWED_STATUSES)[number];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const orderId = Number(id);
    const body = await request.json();
    const newStatus = body.orderStatus as OrderStatus;

    if (!ALLOWED_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: "Status pesanan tidak valid." }, { status: 400 });
    }

    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!existing) {
        throw new Error("Pesanan tidak ditemukan.");
      }

      const oldStatus = existing.orderStatus;

      const [nextOrder] = await tx
        .update(orders)
        .set({ orderStatus: newStatus })
        .where(eq(orders.id, orderId))
        .returning();

      // If transitioning TO Cancelled from non-Cancelled, restore limited stock & log audit
      if (newStatus === "Cancelled" && oldStatus !== "Cancelled") {
        const qtyMap = new Map<number, number>();
        for (const item of existing.itemsJson) {
          qtyMap.set(item.product_id, (qtyMap.get(item.product_id) ?? 0) + item.qty);
        }

        for (const [productId, restoreQty] of qtyMap.entries()) {
          await tx.execute(
            sql`UPDATE products SET remaining_stock = LEAST(daily_quota, remaining_stock + ${restoreQty}) WHERE id = ${productId} AND is_limited_stock = true`
          );
        }

        await tx.insert(auditLogs).values({
          actorName: session.name,
          actionType: "ORDER_CANCELLED",
          targetEntity: existing.orderCode,
          detailsJson: {
            before: { orderStatus: oldStatus },
            after: { orderStatus: "Cancelled" },
            note: "Pesanan dibatalkan & stok terbatas dikembalikan otomatis.",
          },
        });
      }

      return nextOrder;
    });

    revalidateTag("catalog");
    return NextResponse.json({ order: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal memperbarui status pesanan.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

