import { NextRequest, NextResponse } from "next/server";
import { verifyLoginToken } from "@/lib/magic-login";
import { prisma } from "@/lib/prisma";

// API endpoint to handle magic link login
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const redirect = searchParams.get("redirect") || "/dashboard";

    if (!token) {
      return NextResponse.json(
        { error: "Missing login token" },
        { status: 400 }
      );
    }

    // Verify token
    const userId = await verifyLoginToken(token);
    if (!userId) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Get user to verify still exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Create session cookie (similar to NextAuth)
    // This uses NextAuth's built-in callback pattern
    const response = NextResponse.redirect(
      new URL(redirect, request.url)
    );

    // Set a temporary session marker
    response.cookies.set("magic-login-verified", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 5, // 5 minutes to complete NextAuth login
    });

    return response;
  } catch (error) {
    console.error("Magic link login error:", error);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
