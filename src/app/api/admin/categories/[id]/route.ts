import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { db, categories } from "@/db";
import { getAdminSession } from "@/lib/auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    const body = await request.json();
    const [updated] = await db
      .update(categories)
      .set({
        name: body.name !== undefined ? String(body.name).trim() : undefined,
        iconName: body.iconName !== undefined ? String(body.iconName) : undefined,
        sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
      })
      .where(eq(categories.id, Number(id)))
      .returning();

    revalidateTag("catalog");
    return NextResponse.json({ category: updated });
  } catch {
    return NextResponse.json({ error: "Gagal memperbarui kategori." }, { status: 500 });
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
    await db.delete(categories).where(eq(categories.id, Number(id)));
    revalidateTag("catalog");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Kategori tidak dapat dihapus karena masih memiliki produk." },
      { status: 400 }
    );
  }
}

