import { NextResponse } from "next/server";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, auditLogs } from "@/db";
import { getAdminSession } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(5, Number(searchParams.get("limit") || 15)));
    const offset = (page - 1) * limit;
    const actionType = searchParams.get("actionType");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const conditions = [];
    if (actionType && actionType !== "ALL") {
      conditions.push(eq(auditLogs.actionType, actionType));
    }
    if (from) {
      conditions.push(gte(auditLogs.createdAt, new Date(`${from}T00:00:00+07:00`)));
    }
    if (to) {
      conditions.push(lte(auditLogs.createdAt, new Date(`${to}T23:59:59+07:00`)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

    return NextResponse.json({
      logs: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.error("Audit logs GET error:", err);
    return NextResponse.json({ error: "Gagal mengambil audit log." }, { status: 500 });
  }
}
