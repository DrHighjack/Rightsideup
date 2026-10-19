import { jwtVerify, SignJWT } from "jose";

export type LoginLinkLifetime = "30m" | "7d";

function getSecret() {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV === "development" ? "fallback-secret-key-change-in-production" : "");
  if (!secret) throw new Error("Missing AUTH_SECRET/NEXTAUTH_SECRET for magic login");
  return new TextEncoder().encode(secret);
}

// Preserve the existing welcome-link lifetime unless a shorter one is requested.
export async function generateLoginToken(userId: string, lifetime: LoginLinkLifetime = "7d") {
  const token = await new SignJWT({ userId, type: "magic-login" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(lifetime)
    .sign(getSecret());

  return token;
}

// Verify magic login token
export async function verifyLoginToken(token: string) {
  try {
    const verified = await jwtVerify(token, getSecret());
    if (
      verified.payload.type !== "magic-login" ||
      typeof verified.payload.userId !== "string"
    ) {
      return null;
    }
    return verified.payload.userId;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}
