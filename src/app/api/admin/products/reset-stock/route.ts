import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db, products, auditLogs } from "@/db";
import { getAdminSession } from "@/lib/auth";

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const limitedBefore = await db
      .select({ id: products.id, name: products.name, remainingStock: products.remainingStock, dailyQuota: products.dailyQuota })
      .from(products)
      .where(eq(products.isLimitedStock, true));

    await db.execute(
      sql`UPDATE products SET remaining_stock = daily_quota WHERE is_limited_stock = true`
    );

    await db.insert(auditLogs).values({
      actorName: session.name,
      actionType: "STOCK_RESET",
      targetEntity: "All Limited Products",
      detailsJson: {
        before: limitedBefore,
        after: limitedBefore.map((p) => ({ ...p, remainingStock: p.dailyQuota })),
        note: "Reset semua stok harian ke kuota awal.",
      },
    });

    revalidateTag("catalog");
    return NextResponse.json({ ok: true, count: limitedBefore.length });
  } catch (err) {
    console.error("Reset stock error:", err);
    return NextResponse.json({ error: "Gagal mereset stok harian." }, { status: 500 });
  }
}

