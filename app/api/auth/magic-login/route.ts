import { NextRequest, NextResponse } from "next/server";
import { verifyLoginToken } from "@/lib/magic-login";
import { prisma } from "@/lib/prisma";
import { generateLoginToken } from "@/lib/magic-login";
import { sendEmail } from "@/lib/email";
import { authLimiter } from "@/lib/ratelimit";
import { z } from "zod";

const requestSchema = z.object({ email: z.string().trim().email() });
const genericMessage = "If an active account exists for that email, a sign-in link has been sent.";

function escapeHtml(value: string) {
  return value.replace(/[&<>\"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
    };
    return entities[character];
  });
}

export async function POST(request: NextRequest) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const [ipLimit, emailLimit] = await Promise.all([
    authLimiter.limit(`magic-login:ip:${ip}`),
    authLimiter.limit(`magic-login:email:${email}`),
  ]);
  if (!ipLimit.success || !emailLimit.success) {
    return NextResponse.json({ error: "Too many requests. Please try again in 15 minutes." }, { status: 429 });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true, role: true, tags: true, accountStatus: true },
    });

    if (
      user &&
      !user.tags.includes("INACTIVE") &&
      !["ADMIN", "SALESMEN"].includes(user.role) &&
      (!["TC", "BROKERAGE"].includes(user.role) || user.accountStatus === "ACTIVE")
    ) {
      const token = await generateLoginToken(user.id, "30m");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://app.northshoresignco.com";
      const loginLink = new URL("/api/auth/magic-login", appUrl);
      loginLink.searchParams.set("token", token);
      loginLink.searchParams.set("redirect", "/dashboard");
      const safeLink = escapeHtml(loginLink.toString());

      try {
        const result = await sendEmail({
          to: user.email,
          subject: "Your North Shore Sign Co sign-in link",
          html: `<p>Use this link to sign in to your North Shore Sign Co account:</p><p><a href="${safeLink}">Sign in to your account</a></p><p>This link expires in 30 minutes. If you did not request it, you can ignore this email.</p>`,
          text: `Sign in to your North Shore Sign Co account: ${loginLink.toString()}\n\nThis link expires in 30 minutes. If you did not request it, you can ignore this email.`,
        });
        if (!result.success) console.warn("[MAGIC_LOGIN] Sign-in email was not sent");
      } catch (emailError) {
        console.error("[MAGIC_LOGIN] Failed to send sign-in email:", emailError);
      }
    }

    return NextResponse.json({ message: genericMessage });
  } catch (error) {
    console.error("[MAGIC_LOGIN] Sign-in link request failed:", error);
    return NextResponse.json({ error: "Unable to process the request right now" }, { status: 500 });
  }
}

// API endpoint to handle magic link login
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    // Only allow relative in-app paths; prevents open redirects to external sites.
    const rawRedirect = searchParams.get("redirect") || "/dashboard";
    const redirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") && !rawRedirect.includes("://")
      ? rawRedirect
      : "/dashboard";

    if (!token) {
      return NextResponse.json(
        { error: "Missing login token" },
        { status: 400 }
      );
    }

    // Verify token
    const userId = await verifyLoginToken(token);
    if (!userId) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("magicLoginError", "1");
      return NextResponse.redirect(loginUrl);
    }

    // Get user to verify still exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, tags: true, accountStatus: true },
    });

    if (
      !user ||
      user.tags.includes("INACTIVE") ||
      ["ADMIN", "SALESMEN"].includes(user.role) ||
      (["TC", "BROKERAGE"].includes(user.role) && user.accountStatus !== "ACTIVE")
    ) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("magicLoginError", "1");
      return NextResponse.redirect(loginUrl);
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("magicLoginToken", token);
    loginUrl.searchParams.set("redirect", redirect);
    return NextResponse.redirect(loginUrl);
  } catch (error) {
    console.error("Magic link login error:", error);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
