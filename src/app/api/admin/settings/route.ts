import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { db, storeSettings, auditLogs } from "@/db";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1);
  return NextResponse.json({ settings: row || null });
}

export async function PUT(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const [existing] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1);

    const payload = {
      id: 1,
      cafeName: String(body.cafeName || "Brew & Bliss Coffee House").trim(),
      tagline: String(body.tagline || "").trim(),
      address: String(body.address || "").trim(),
      mapsEmbedUrl: String(body.mapsEmbedUrl || "").trim(),
      openingHours: String(body.openingHours || "").trim(),
      whatsappNumber: String(body.whatsappNumber || "").trim(),
      isOpenNow: Boolean(body.isOpenNow),
    };

    const [saved] = await db
      .insert(storeSettings)
      .values(payload)
      .onConflictDoUpdate({
        target: storeSettings.id,
        set: payload,
      })
      .returning();

    await db.insert(auditLogs).values({
      actorName: session.name,
      actionType: "SETTINGS_UPDATED",
      targetEntity: "Store Settings",
      detailsJson: { before: existing ?? null, after: saved },
    });

    revalidateTag("catalog");
    return NextResponse.json({ settings: saved });
  } catch (err) {
    console.error("Settings PUT error:", err);
    return NextResponse.json({ error: "Gagal menyimpan pengaturan toko." }, { status: 500 });
  }
}
