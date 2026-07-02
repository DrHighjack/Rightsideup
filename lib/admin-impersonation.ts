import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "fallback-secret-key-change-in-production"
);

type ImpersonationPayload = {
  adminUserId: string;
  targetUserId: string;
  type: "admin-impersonation";
};

export async function generateAdminImpersonationToken(
  adminUserId: string,
  targetUserId: string
) {
  return new SignJWT({
    adminUserId,
    targetUserId,
    type: "admin-impersonation",
  } satisfies ImpersonationPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(secret);
}

export async function verifyAdminImpersonationToken(token: string) {
  try {
    const verified = await jwtVerify(token, secret);
    if (verified.payload.type !== "admin-impersonation") {
      return null;
    }

    const adminUserId = verified.payload.adminUserId;
    const targetUserId = verified.payload.targetUserId;

    if (typeof adminUserId !== "string" || typeof targetUserId !== "string") {
      return null;
    }

    return { adminUserId, targetUserId };
  } catch (error) {
    console.error("Impersonation token verification failed:", error);
    return null;
  }
}
