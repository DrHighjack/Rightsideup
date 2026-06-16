import { jwtVerify, SignJWT } from "jose";

const secret = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "fallback-secret-key-change-in-production"
);

// Generate a magic login link token (valid for 7 days)
export async function generateLoginToken(userId: string) {
  const token = await new SignJWT({ userId, type: "magic-login" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);

  return token;
}

// Verify magic login token
export async function verifyLoginToken(token: string) {
  try {
    const verified = await jwtVerify(token, secret);
    if (verified.payload.type !== "magic-login") {
      return null;
    }
    return verified.payload.userId as string;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}
