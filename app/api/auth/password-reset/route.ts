import { NextRequest, NextResponse } from "next/server";
import { sendEmail, getAccountActivationWelcomeEmail, getPasswordResetEmail } from "@/lib/email";
import { sendSMS, getPasswordResetSMS } from "@/lib/sms";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { hash } from "bcryptjs";

const RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function getResetSecret() {
  const secret = process.env.PASSWORD_RESET_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("Missing PASSWORD_RESET_SECRET or NEXTAUTH_SECRET");
  }
  return secret;
}

function toBase64Url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function passwordTag(passwordHash: string) {
  return crypto.createHash("sha256").update(passwordHash).digest("hex").slice(0, 24);
}

function signPayload(payloadB64: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function createResetToken(userId: string, currentPasswordHash: string) {
  const payload = {
    uid: userId,
    exp: Date.now() + RESET_TOKEN_TTL_MS,
    nonce: crypto.randomBytes(16).toString("hex"),
    pt: passwordTag(currentPasswordHash),
  };

  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(payloadB64, getResetSecret());
  return `${payloadB64}.${signature}`;
}

async function verifyResetToken(token: string) {
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) {
    return { valid: false as const, error: "Invalid or expired token" };
  }

  const expectedSignature = signPayload(payloadB64, getResetSecret());
  const providedSigBuffer = Buffer.from(signature, "utf8");
  const expectedSigBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    providedSigBuffer.length !== expectedSigBuffer.length ||
    !crypto.timingSafeEqual(providedSigBuffer, expectedSigBuffer)
  ) {
    return { valid: false as const, error: "Invalid or expired token" };
  }

  let payload: { uid?: string; exp?: number; pt?: string };
  try {
    payload = JSON.parse(fromBase64Url(payloadB64));
  } catch {
    return { valid: false as const, error: "Invalid or expired token" };
  }

  if (!payload.uid || !payload.exp || !payload.pt || payload.exp < Date.now()) {
    return { valid: false as const, error: "Invalid or expired token" };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    return { valid: false as const, error: "Invalid or expired token" };
  }

  if (passwordTag(user.passwordHash) !== payload.pt) {
    return { valid: false as const, error: "Invalid or expired token" };
  }

  return { valid: true as const, userId: user.id };
}

export async function POST(request: NextRequest) {
  try {
    const { email, sendViaSMS, accountActivation } = await request.json();
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = forwardedHost || request.headers.get("host");
    const requestOrigin = host
      ? `${forwardedProto || "https"}://${host}`
      : request.nextUrl.origin;

    const configuredAppUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";

    // Prefer the live request origin to avoid mismatched domain links.
    const appUrl = (requestOrigin || configuredAppUrl || "https://app.northshoresignco.com").replace(/\/$/, "");

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        firstName: true,
        email: true,
        phone: true,
        passwordHash: true,
        role: true,
        tags: true,
        brokerage: { select: { name: true } },
      },
    });

    if (!user) {
      // Don't reveal if user exists or not (security best practice)
      return NextResponse.json({
        message: "If that email exists, we've sent a reset link.",
      });
    }

    // Generate signed reset token that works across instances.
    const token = createResetToken(user.id, user.passwordHash);
    const resetUrl = new URL("/reset-password", appUrl);
    resetUrl.searchParams.set("token", token);
    const resetLink = resetUrl.toString();

    // Send via email (always)
    try {
      const firstName = typeof user.firstName === "string" ? user.firstName : "User";
      const canSendActivation =
        accountActivation === true &&
        (user.tags.includes("IMPORTED_WINDERMERE") || user.tags.includes("SHARED_ACCOUNTANT"));
      const emailTemplate = canSendActivation
        ? getAccountActivationWelcomeEmail({
            firstName,
            officeName: user.brokerage?.name || "your Windermere office",
            activationLink: resetLink,
            accountTitle: user.tags.includes("PROPERTY_MANAGER")
              ? "Property Manager"
              : user.role === "TC"
                ? "Transaction Coordinator"
                : user.role === "BROKERAGE"
                  ? "Accountant"
                  : "Realtor",
          })
        : getPasswordResetEmail(firstName, resetLink);
      await sendEmail({
        to: user.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      // Continue even if email fails, try SMS if requested
    }

    // Send via SMS if requested and phone available
    if (sendViaSMS && user.phone) {
      try {
        const smsMessage = getPasswordResetSMS(user.firstName, resetLink);
        await sendSMS({
          to: user.phone,
          message: smsMessage,
        });
      } catch (smsError) {
        console.error("Failed to send SMS:", smsError);
        // Log but don't fail the request
      }
    }

    return NextResponse.json({
      message: "Password reset instructions have been sent.",
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    return NextResponse.json(
      { error: "Failed to process password reset request" },
      { status: 500 }
    );
  }
}

// GET endpoint to verify token (for password reset page)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    const verification = await verifyResetToken(token);

    if (!verification.valid) {
      return NextResponse.json({ error: verification.error }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      userId: verification.userId,
    });
  } catch (error) {
    console.error("Token verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify token" },
      { status: 500 }
    );
  }
}

// PUT endpoint to set a new password using a reset token
export async function PUT(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const verification = await verifyResetToken(token);
    if (!verification.valid) {
      return NextResponse.json({ error: verification.error }, { status: 400 });
    }

    const passwordHash = await hash(password, 12);

    await prisma.user.update({
      where: { id: verification.userId },
      data: { passwordHash },
    });

    return NextResponse.json({ success: true, message: "Password reset successful" });
  } catch (error) {
    console.error("Password reset update error:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
