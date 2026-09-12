import { NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MOBILE_TOKEN_TTL = "30d";

function getMobileSecret(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV === "development" ? "dev-only-nextauth-secret-change-me" : undefined);
  if (!secret) {
    throw new Error("Missing AUTH_SECRET/NEXTAUTH_SECRET for mobile auth");
  }
  return new TextEncoder().encode(secret);
}

export interface MobileTokenPayload {
  sub: string; // userId
  role: string;
  email: string;
}

/** Issues a long-lived JWT for the iOS app to store in the Keychain. */
export async function issueMobileToken(payload: MobileTokenPayload): Promise<string> {
  return new SignJWT({ role: payload.role, email: payload.email, type: "mobile" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(MOBILE_TOKEN_TTL)
    .sign(getMobileSecret());
}

async function verifyMobileToken(token: string): Promise<MobileTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getMobileSecret());
    if (payload.type !== "mobile" || !payload.sub) return null;
    return { sub: payload.sub as string, role: payload.role as string, email: payload.email as string };
  } catch {
    return null;
  }
}

export interface RequestUser {
  id: string;
  role: string;
  email: string;
}

/**
 * Resolves the current user from either a NextAuth session cookie (web)
 * or a `Authorization: Bearer <token>` mobile JWT (iOS app), so existing
 * API routes can serve both clients without duplicating logic.
 */
export async function getRequestUser(request: NextRequest): Promise<RequestUser | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    const payload = await verifyMobileToken(token);
    if (!payload) return null;

    // Re-check the user still exists/active on every request; tokens are long-lived.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, email: true, tags: true },
    });
    if (!user || user.tags.includes("INACTIVE")) return null;

    return { id: user.id, role: user.role, email: user.email };
  }

  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id, role: session.user.role as string, email: session.user.email as string };
}
