import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { asc, eq, sql } from "drizzle-orm";
import { db, products, productVariants, auditLogs } from "@/db";
import { getAdminSession } from "@/lib/auth";
import { deleteImageFromStorage } from "@/lib/storage";
import { slugify } from "@/lib/format";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [prodRows, varRows] = await Promise.all([
      db.select().from(products).orderBy(asc(products.id)),
      db.select().from(productVariants).orderBy(asc(productVariants.id)),
    ]);

    const varMap = new Map<number, typeof varRows>();
    for (const v of varRows) {
      const list = varMap.get(v.productId) ?? [];
      list.push(v);
      varMap.set(v.productId, list);
    }

    return NextResponse.json({
      products: prodRows.map((p) => ({ ...p, variants: varMap.get(p.id) ?? [] })),
    });
  } catch (err) {
    console.error("Admin products GET error:", err);
    return NextResponse.json({ error: "Gagal mengambil data produk." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("action") === "reset-stock") {
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`UPDATE products SET remaining_stock = daily_quota WHERE is_limited_stock = true`
        );
        await tx.insert(auditLogs).values({
          actorName: session.name,
          actionType: "STOCK_RESET",
          targetEntity: "All Limited Stock Products",
          detailsJson: {
            before: null,
            after: { resetToDailyQuota: true },
          },
        });
      });

      revalidateTag("catalog");
      return NextResponse.json({ ok: true });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const categoryId = Number(body.categoryId);
    const price = Number(body.price);
    const discountPrice = body.discountPrice ? Number(body.discountPrice) : null;
    const imageUrl = String(body.imageUrl || "").trim();

    if (!name || !categoryId || !price || !imageUrl) {
      return NextResponse.json(
        { error: "Nama, kategori, harga, dan foto produk wajib diisi." },
        { status: 400 }
      );
    }

    const slug = `${slugify(name)}-${Date.now().toString(36)}`;
    const isLimitedStock = Boolean(body.isLimitedStock);
    const dailyQuota = isLimitedStock ? Math.max(0, Number(body.dailyQuota || 0)) : 0;
    const remainingStock = isLimitedStock
      ? Math.max(0, Number(body.remainingStock ?? dailyQuota))
      : 0;

    const created = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(products)
        .values({
          categoryId,
          name,
          slug,
          description: String(body.description || ""),
          price,
          discountPrice,
          imageUrl,
          badgeLabel: body.badgeLabel ? String(body.badgeLabel).trim() : null,
          isLimitedStock,
          dailyQuota,
          remainingStock,
          isAvailable: body.isAvailable !== false,
        })
        .returning();

      const variants = Array.isArray(body.variants) ? body.variants : [];
      if (variants.length > 0) {
        await tx.insert(productVariants).values(
          variants.map((v: { groupName: string; optionName: string; additionalPrice: number; isRequired: boolean }) => ({
            productId: inserted.id,
            groupName: String(v.groupName).trim(),
            optionName: String(v.optionName).trim(),
            additionalPrice: Number(v.additionalPrice || 0),
            isRequired: Boolean(v.isRequired),
          }))
        );
      }

      await tx.insert(auditLogs).values({
        actorName: session.name,
        actionType: "PRODUCT_UPDATED",
        targetEntity: `Product #${inserted.id} (${inserted.name})`,
        detailsJson: { before: null, after: inserted },
      });

      return inserted;
    });

    revalidateTag("catalog");
    return NextResponse.json({ product: created }, { status: 201 });
  } catch (err) {
    console.error("Admin products POST error:", err);
    return NextResponse.json({ error: "Gagal menyimpan produk." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return NextResponse.json({ error: "ID produk tidak valid." }, { status: 400 });

    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });

    const isLimitedStock = Boolean(body.isLimitedStock);
    const dailyQuota = isLimitedStock ? Math.max(0, Number(body.dailyQuota || 0)) : 0;
    const remainingStock = isLimitedStock
      ? Math.max(0, Number(body.remainingStock ?? dailyQuota))
      : 0;
    const newImageUrl = String(body.imageUrl || existing.imageUrl).trim();

    const updated = await db.transaction(async (tx) => {
      const [saved] = await tx
        .update(products)
        .set({
          categoryId: Number(body.categoryId ?? existing.categoryId),
          name: String(body.name ?? existing.name).trim(),
          description: String(body.description ?? existing.description),
          price: Number(body.price ?? existing.price),
          discountPrice:
            body.discountPrice === null || body.discountPrice === ""
              ? null
              : Number(body.discountPrice),
          imageUrl: newImageUrl,
          badgeLabel: body.badgeLabel ? String(body.badgeLabel).trim() : null,
          isLimitedStock,
          dailyQuota,
          remainingStock,
          isAvailable: body.isAvailable !== false,
        })
        .where(eq(products.id, id))
        .returning();

      if (Array.isArray(body.variants)) {
        await tx.delete(productVariants).where(eq(productVariants.productId, id));
        if (body.variants.length > 0) {
          await tx.insert(productVariants).values(
            body.variants.map(
              (v: { groupName: string; optionName: string; additionalPrice: number; isRequired: boolean }) => ({
                productId: id,
                groupName: String(v.groupName).trim(),
                optionName: String(v.optionName).trim(),
                additionalPrice: Number(v.additionalPrice || 0),
                isRequired: Boolean(v.isRequired),
              })
            )
          );
        }
      }

      await tx.insert(auditLogs).values({
        actorName: session.name,
        actionType: "PRODUCT_UPDATED",
        targetEntity: `Product #${id} (${saved.name})`,
        detailsJson: {
          before: { price: existing.price, remainingStock: existing.remainingStock, isAvailable: existing.isAvailable },
          after: { price: saved.price, remainingStock: saved.remainingStock, isAvailable: saved.isAvailable },
        },
      });

      return saved;
    });

    if (existing.imageUrl && existing.imageUrl !== newImageUrl) {
      await deleteImageFromStorage(existing.imageUrl);
    }

    revalidateTag("catalog");
    return NextResponse.json({ product: updated });
  } catch (err) {
    console.error("Admin products PUT error:", err);
    return NextResponse.json({ error: "Gagal memperbarui produk." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "ID produk tidak valid." }, { status: 400 });

    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });

    await db.delete(products).where(eq(products.id, id));
    await deleteImageFromStorage(existing.imageUrl);

    await db.insert(auditLogs).values({
      actorName: session.name,
      actionType: "PRODUCT_UPDATED",
      targetEntity: `Product #${id} (${existing.name})`,
      detailsJson: { before: existing, after: { deleted: true } },
    });

    revalidateTag("catalog");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin products DELETE error:", err);
    return NextResponse.json({ error: "Gagal menghapus produk." }, { status: 500 });
  }
}
