import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db, vouchers, auditLogs } from "@/db";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.select().from(vouchers).orderBy(asc(vouchers.id));
  return NextResponse.json({ vouchers: rows });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const code = String(body.code || "").trim().toUpperCase();
    if (!code) return NextResponse.json({ error: "Kode voucher wajib diisi." }, { status: 400 });

    const [created] = await db
      .insert(vouchers)
      .values({
        code,
        discountType: body.discountType === "fixed" ? "fixed" : "percentage",
        discountValue: Math.max(1, Number(body.discountValue || 0)),
        minOrderAmount: Math.max(0, Number(body.minOrderAmount || 0)),
        maxDiscountAmount: body.maxDiscountAmount ? Number(body.maxDiscountAmount) : null,
        usageLimit: body.usageLimit ? Number(body.usageLimit) : null,
        validFrom: body.validFrom ? new Date(body.validFrom) : new Date(),
        validUntil: body.validUntil
          ? new Date(body.validUntil)
          : new Date(Date.now() + 30 * 86400 * 1000),
        isActive: body.isActive !== false,
      })
      .returning();

    await db.insert(auditLogs).values({
      actorName: session.name,
      actionType: "VOUCHER_CHANGED",
      targetEntity: `Voucher ${created.code}`,
      detailsJson: { before: null, after: created },
    });

    revalidateTag("catalog");
    return NextResponse.json({ voucher: created }, { status: 201 });
  } catch (err) {
    console.error("Voucher POST error:", err);
    return NextResponse.json({ error: "Gagal menyimpan voucher (kode mungkin sudah ada)." }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const id = Number(body.id);
    const [existing] = await db.select().from(vouchers).where(eq(vouchers.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: "Voucher tidak ditemukan." }, { status: 404 });

    const [updated] = await db
      .update(vouchers)
      .set({
        code: String(body.code || existing.code).trim().toUpperCase(),
        discountType: body.discountType === "fixed" ? "fixed" : "percentage",
        discountValue: Math.max(1, Number(body.discountValue ?? existing.discountValue)),
        minOrderAmount: Math.max(0, Number(body.minOrderAmount ?? existing.minOrderAmount)),
        maxDiscountAmount: body.maxDiscountAmount ? Number(body.maxDiscountAmount) : null,
        usageLimit: body.usageLimit ? Number(body.usageLimit) : null,
        validFrom: body.validFrom ? new Date(body.validFrom) : existing.validFrom,
        validUntil: body.validUntil ? new Date(body.validUntil) : existing.validUntil,
        isActive: body.isActive !== false,
      })
      .where(eq(vouchers.id, id))
      .returning();

    await db.insert(auditLogs).values({
      actorName: session.name,
      actionType: "VOUCHER_CHANGED",
      targetEntity: `Voucher ${updated.code}`,
      detailsJson: { before: existing, after: updated },
    });

    revalidateTag("catalog");
    return NextResponse.json({ voucher: updated });
  } catch (err) {
    console.error("Voucher PUT error:", err);
    return NextResponse.json({ error: "Gagal memperbarui voucher." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    const [existing] = await db.select().from(vouchers).where(eq(vouchers.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: "Voucher tidak ditemukan." }, { status: 404 });

    await db.delete(vouchers).where(eq(vouchers.id, id));
    await db.insert(auditLogs).values({
      actorName: session.name,
      actionType: "VOUCHER_CHANGED",
      targetEntity: `Voucher ${existing.code}`,
      detailsJson: { before: existing, after: { deleted: true } },
    });

    revalidateTag("catalog");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Voucher DELETE error:", err);
    return NextResponse.json({ error: "Gagal menghapus voucher." }, { status: 500 });
  }
}
