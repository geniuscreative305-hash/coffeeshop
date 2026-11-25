import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, adminUsers } from "@/db";
import { ADMIN_COOKIE_NAME, signAdminToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi." }, { status: 400 });
    }

    const [admin] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email))
      .limit(1);

    let isValid = false;
    let adminName = "Admin";
    let adminId = "1";

    if (admin) {
      isValid = await bcrypt.compare(password, admin.passwordHash);
      adminName = admin.name;
      adminId = String(admin.id);
    } else {
      // Fallback check against env default if not yet seeded
      const envEmail = (process.env.ADMIN_DEFAULT_EMAIL || "").trim().toLowerCase();
      const envPass = process.env.ADMIN_DEFAULT_PASSWORD || "";
      if (envEmail && envPass && email === envEmail && password === envPass) {
        isValid = true;
        adminName = "Head Barista & Admin";
      }
    }

    if (!isValid) {
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
    }

    const token = await signAdminToken({
      sub: adminId,
      email,
      name: adminName,
    });

    const response = NextResponse.json({
      user: { id: adminId, email, name: adminName },
    });

    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (err) {
    console.error("Admin login error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan saat login." }, { status: 500 });
  }
}

