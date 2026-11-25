import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { asc, eq } from "drizzle-orm";
import crypto from "crypto";
import { db, cafeTables } from "@/db";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.select().from(cafeTables).orderBy(asc(cafeTables.tableNumber));
  return NextResponse.json({ tables: rows });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const tableNumber = String(body.tableNumber || "").trim().toUpperCase();
    if (!tableNumber) {
      return NextResponse.json({ error: "Nomor meja wajib diisi." }, { status: 400 });
    }

    const [created] = await db
      .insert(cafeTables)
      .values({
        tableNumber,
        qrToken: crypto.randomBytes(12).toString("hex"),
        isActive: body.isActive !== false,
      })
      .returning();

    revalidateTag("catalog");
    return NextResponse.json({ table: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Nomor meja sudah terdaftar." }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const id = Number(body.id);
    const [updated] = await db
      .update(cafeTables)
      .set({
        isActive: Boolean(body.isActive),
      })
      .where(eq(cafeTables.id, id))
      .returning();

    revalidateTag("catalog");
    return NextResponse.json({ table: updated });
  } catch {
    return NextResponse.json({ error: "Gagal memperbarui meja." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    await db.delete(cafeTables).where(eq(cafeTables.id, id));
    revalidateTag("catalog");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Gagal menghapus meja." }, { status: 500 });
  }
}
