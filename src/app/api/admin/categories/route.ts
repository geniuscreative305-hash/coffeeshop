import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db, categories } from "@/db";
import { getAdminSession } from "@/lib/auth";
import { slugify } from "@/lib/format";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.id));
  return NextResponse.json({ categories: rows });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Nama kategori wajib diisi." }, { status: 400 });

    const [created] = await db
      .insert(categories)
      .values({
        name,
        slug: slugify(name),
        iconName: String(body.iconName || "Coffee"),
        sortOrder: Number(body.sortOrder || 0),
        isActive: body.isActive !== false,
      })
      .returning();

    revalidateTag("catalog");
    return NextResponse.json({ category: created }, { status: 201 });
  } catch (err) {
    console.error("Category POST error:", err);
    return NextResponse.json({ error: "Gagal membuat kategori." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return NextResponse.json({ error: "ID kategori tidak valid." }, { status: 400 });

    const [updated] = await db
      .update(categories)
      .set({
        name: String(body.name || "").trim(),
        iconName: String(body.iconName || "Coffee"),
        sortOrder: Number(body.sortOrder || 0),
        isActive: body.isActive !== false,
      })
      .where(eq(categories.id, id))
      .returning();

    revalidateTag("catalog");
    return NextResponse.json({ category: updated });
  } catch (err) {
    console.error("Category PUT error:", err);
    return NextResponse.json({ error: "Gagal memperbarui kategori." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    await db.delete(categories).where(eq(categories.id, id));
    revalidateTag("catalog");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Kategori tidak dapat dihapus karena masih memiliki produk." },
      { status: 400 }
    );
  }
}
