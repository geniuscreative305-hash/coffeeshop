import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, vouchers } from "@/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = String(body.code ?? "").trim().toUpperCase();
    const subtotal = Number(body.subtotal ?? 0);

    if (!code) {
      return NextResponse.json({ error: "Kode voucher wajib diisi." }, { status: 400 });
    }

    const [voucher] = await db
      .select()
      .from(vouchers)
      .where(eq(vouchers.code, code))
      .limit(1);

    if (!voucher || !voucher.isActive) {
      return NextResponse.json({ error: "Kode voucher tidak ditemukan atau tidak aktif." }, { status: 404 });
    }

    const now = new Date();
    if (now < voucher.validFrom || now > voucher.validUntil) {
      return NextResponse.json({ error: "Kode voucher sudah kedaluwarsa atau belum berlaku." }, { status: 400 });
    }

    if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) {
      return NextResponse.json({ error: "Kuota penggunaan voucher telah habis." }, { status: 400 });
    }

    if (subtotal < voucher.minOrderAmount) {
      return NextResponse.json(
        {
          error: `Minimal belanja untuk voucher ini adalah Rp ${voucher.minOrderAmount.toLocaleString("id-ID")}.`,
        },
        { status: 400 }
      );
    }

    let discountAmount = 0;
    if (voucher.discountType === "percentage") {
      discountAmount = Math.floor((subtotal * voucher.discountValue) / 100);
      if (voucher.maxDiscountAmount !== null && discountAmount > voucher.maxDiscountAmount) {
        discountAmount = voucher.maxDiscountAmount;
      }
    } else {
      discountAmount = voucher.discountValue;
    }

    discountAmount = Math.min(discountAmount, subtotal);

    return NextResponse.json({
      valid: true,
      code: voucher.code,
      discountType: voucher.discountType,
      discountValue: voucher.discountValue,
      discountAmount,
    });
  } catch (err) {
    console.error("Voucher validation error:", err);
    return NextResponse.json({ error: "Gagal memvalidasi voucher." }, { status: 500 });
  }
}
