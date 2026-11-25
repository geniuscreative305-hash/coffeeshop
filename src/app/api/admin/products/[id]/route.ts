import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { db, products, productVariants, auditLogs } from "@/db";
import { getAdminSession } from "@/lib/auth";
import { deleteImageFromStorage } from "@/lib/storage";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    const productId = Number(id);
    const body = await request.json();

    const [existing] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    }

    const newImageUrl = body.imageUrl ? String(body.imageUrl).trim() : existing.imageUrl;
    const isLimitedStock =
      body.isLimitedStock !== undefined ? Boolean(body.isLimitedStock) : existing.isLimitedStock;
    const dailyQuota = isLimitedStock
      ? Math.max(0, Number(body.dailyQuota ?? existing.dailyQuota))
      : 0;
    const remainingStock = isLimitedStock
      ? Math.max(0, Number(body.remainingStock ?? existing.remainingStock))
      : 0;

    const [updated] = await db
      .update(products)
      .set({
        categoryId: body.categoryId !== undefined ? Number(body.categoryId) : existing.categoryId,
        name: body.name !== undefined ? String(body.name).trim() : existing.name,
        description: body.description !== undefined ? String(body.description) : existing.description,
        price: body.price !== undefined ? Math.max(0, Number(body.price)) : existing.price,
        discountPrice:
          body.discountPrice !== undefined
            ? body.discountPrice === null || body.discountPrice === ""
              ? null
              : Number(body.discountPrice)
            : existing.discountPrice,
        imageUrl: newImageUrl,
        badgeLabel:
          body.badgeLabel !== undefined
            ? body.badgeLabel
              ? String(body.badgeLabel).trim()
              : null
            : existing.badgeLabel,
        isLimitedStock,
        dailyQuota,
        remainingStock,
        isAvailable: body.isAvailable !== undefined ? Boolean(body.isAvailable) : existing.isAvailable,
      })
      .where(eq(products.id, productId))
      .returning();

    if (Array.isArray(body.variants)) {
      await db.delete(productVariants).where(eq(productVariants.productId, productId));
      if (body.variants.length > 0) {
        await db.insert(productVariants).values(
          body.variants.map((v: { groupName: string; optionName: string; additionalPrice: number; isRequired: boolean }) => ({
            productId,
            groupName: String(v.groupName).trim(),
            optionName: String(v.optionName).trim(),
            additionalPrice: Math.max(0, Number(v.additionalPrice ?? 0)),
            isRequired: Boolean(v.isRequired),
          }))
        );
      }
    }

    // Clean up orphan image if replaced
    if (newImageUrl !== existing.imageUrl) {
      await deleteImageFromStorage(existing.imageUrl);
    }

    await db.insert(auditLogs).values({
      actorName: session.name,
      actionType: "PRODUCT_UPDATED",
      targetEntity: updated.name,
      detailsJson: {
        before: { price: existing.price, isAvailable: existing.isAvailable, remainingStock: existing.remainingStock },
        after: { price: updated.price, isAvailable: updated.isAvailable, remainingStock: updated.remainingStock },
      },
    });

    revalidateTag("catalog");
    return NextResponse.json({ product: updated });
  } catch (err) {
    console.error("Update product error:", err);
    return NextResponse.json({ error: "Gagal memperbarui produk." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    const productId = Number(id);

    const [existing] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    }

    await db.delete(products).where(eq(products.id, productId));
    await deleteImageFromStorage(existing.imageUrl);

    await db.insert(auditLogs).values({
      actorName: session.name,
      actionType: "PRODUCT_UPDATED",
      targetEntity: existing.name,
      detailsJson: {
        before: { id: existing.id, name: existing.name },
        after: null,
        note: "Produk dihapus",
      },
    });

    revalidateTag("catalog");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete product error:", err);
    return NextResponse.json({ error: "Gagal menghapus produk." }, { status: 500 });
  }
}

