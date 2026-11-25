import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db, promos } from "@/db";
import { getAdminSession } from "@/lib/auth";
import { deleteImageFromStorage } from "@/lib/storage";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.select().from(promos).orderBy(asc(promos.id));
  return NextResponse.json({ promos: rows });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const bannerImageUrl = String(body.bannerImageUrl ?? "").trim();
    if (!title || !bannerImageUrl) {
      return NextResponse.json(
        { error: "Judul promo dan gambar banner 16:9 wajib diisi." },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(promos)
      .values({
        title,
        subtitle: String(body.subtitle ?? "").trim(),
        discountText: String(body.discountText ?? "").trim(),
        bannerImageUrl,
        isActive: body.isActive !== false,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
      })
      .returning();

    revalidateTag("catalog");
    return NextResponse.json({ promo: created }, { status: 201 });
  } catch (err) {
    console.error("Create promo error:", err);
    return NextResponse.json({ error: "Gagal menambah promo." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const id = Number(body.id);
    const [existing] = await db.select().from(promos).where(eq(promos.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: "Promo tidak ditemukan." }, { status: 404 });

    const newBannerUrl = body.bannerImageUrl
      ? String(body.bannerImageUrl).trim()
      : existing.bannerImageUrl;

    const [updated] = await db
      .update(promos)
      .set({
        title: body.title !== undefined ? String(body.title).trim() : existing.title,
        subtitle: body.subtitle !== undefined ? String(body.subtitle).trim() : existing.subtitle,
        discountText:
          body.discountText !== undefined ? String(body.discountText).trim() : existing.discountText,
        bannerImageUrl: newBannerUrl,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive,
        validUntil:
          body.validUntil !== undefined
            ? body.validUntil
              ? new Date(body.validUntil)
              : null
            : existing.validUntil,
      })
      .where(eq(promos.id, id))
      .returning();

    if (newBannerUrl !== existing.bannerImageUrl) {
      await deleteImageFromStorage(existing.bannerImageUrl);
    }

    revalidateTag("catalog");
    return NextResponse.json({ promo: updated });
  } catch (err) {
    console.error("Update promo error:", err);
    return NextResponse.json({ error: "Gagal memperbarui promo." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    const [existing] = await db.select().from(promos).where(eq(promos.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: "Promo tidak ditemukan." }, { status: 404 });

    await db.delete(promos).where(eq(promos.id, id));
    await deleteImageFromStorage(existing.bannerImageUrl);

    revalidateTag("catalog");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete promo error:", err);
    return NextResponse.json({ error: "Gagal menghapus promo." }, { status: 500 });
  }
}
