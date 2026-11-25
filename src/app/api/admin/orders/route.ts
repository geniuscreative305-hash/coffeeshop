import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, orders } from "@/db";
import { getAdminSession } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const validStatuses = ["Pending", "Brewing", "Ready", "Completed", "Cancelled"] as const;
    type ValidStatus = (typeof validStatuses)[number];

    const rows =
      status && validStatuses.includes(status as ValidStatus)
        ? await db
            .select()
            .from(orders)
            .where(eq(orders.orderStatus, status as ValidStatus))
            .orderBy(desc(orders.createdAt))
            .limit(150)
        : await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(150);

    return NextResponse.json({ orders: rows });
  } catch (err) {
    console.error("Fetch orders error:", err);
    return NextResponse.json({ error: "Gagal memuat daftar pesanan." }, { status: 500 });
  }
}
