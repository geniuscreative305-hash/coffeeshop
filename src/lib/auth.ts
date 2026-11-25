import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "bb_admin_session";

export interface AdminSessionPayload {
  sub: string;
  email: string;
  name: string;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || "dev-fallback-secret-change-in-production-32chars";
  return new TextEncoder().encode(secret);
}

export async function signAdminToken(payload: AdminSessionPayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    name: payload.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getJwtSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.sub || !payload.email) return null;
    return {
      sub: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name || "Admin"),
    };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}
