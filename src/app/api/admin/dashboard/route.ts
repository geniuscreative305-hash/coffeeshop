import { NextResponse } from "next/server";
import { and, desc, gte, lte } from "drizzle-orm";
import { db, orders } from "@/db";
import { getAdminSession } from "@/lib/auth";
import { getJakartaDateKey } from "@/lib/format";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    // Default to today in Asia/Jakarta
    const todayKey = getJakartaDateKey(new Date());
    const defaultDate = `${todayKey.slice(0, 4)}-${todayKey.slice(4, 6)}-${todayKey.slice(6, 8)}`;
    const startDate = new Date(`${startParam || defaultDate}T00:00:00+07:00`);
    const endDate = new Date(`${endParam || defaultDate}T23:59:59.999+07:00`);

    const rows = await db
      .select()
      .from(orders)
      .where(and(gte(orders.createdAt, startDate), lte(orders.createdAt, endDate)))
      .orderBy(desc(orders.createdAt));

    let grossRevenue = 0;
    let totalDiscount = 0;
    let netRevenue = 0;
    let completedCount = 0;
    let activeCount = 0;

    const categoryTotals = new Map<string, number>();
    const paymentTotals = new Map<string, { total: number; count: number }>();

    for (const ord of rows) {
      if (ord.orderStatus === "Pending" || ord.orderStatus === "Brewing" || ord.orderStatus === "Ready") {
        activeCount += 1;
      }

      if (ord.orderStatus !== "Cancelled") {
        grossRevenue += ord.subtotal;
        totalDiscount += ord.discountAmount;
        netRevenue += ord.totalAmount;
        if (ord.orderStatus === "Completed") {
          completedCount += 1;
        }

        for (const item of ord.itemsJson) {
          const cat = item.category_name || "Lainnya";
          categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + item.item_total);
        }

        const pEntry = paymentTotals.get(ord.paymentMethod) ?? { total: 0, count: 0 };
        pEntry.total += ord.totalAmount;
        pEntry.count += 1;
        paymentTotals.set(ord.paymentMethod, pEntry);
      }
    }

    return NextResponse.json({
      period: {
        start: startParam || defaultDate,
        end: endParam || defaultDate,
      },
      summary: {
        grossRevenue,
        totalDiscount,
        netRevenue,
        completedCount,
        activeCount,
        totalOrders: rows.length,
      },
      byCategory: Array.from(categoryTotals.entries()).map(([category, total]) => ({
        category,
        total,
      })),
      byPayment: Array.from(paymentTotals.entries()).map(([method, data]) => ({
        method,
        total: data.total,
        count: data.count,
      })),
      orders: rows,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return NextResponse.json({ error: "Gagal memuat ringkasan dashboard." }, { status: 500 });
  }
}

