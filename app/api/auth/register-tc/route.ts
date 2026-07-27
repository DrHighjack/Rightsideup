import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import crypto from "crypto";
import { sendEmail, getAccountVerificationEmail } from "@/lib/email";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  "https://app.northshoresignco.com";

export async function POST(request: Request) {
  try {
    const { email, firstName, lastName, password, inviteToken } =
      await request.json();

    if (!email || !firstName || !lastName || !password || !inviteToken) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Validate invite
    const invite = await prisma.tCInvite.findUnique({
      where: { token: inviteToken },
      include: {
        invitedByUser: {
          select: { role: true },
        },
      },
    });

    if (!invite) {
      return Response.json({ error: "Invalid invite token" }, { status: 404 });
    }

    if (!["REALTOR", "ADMIN"].includes(invite.invitedByUser.role)) {
      return Response.json(
        { error: "This invite token is not valid for TC registration" },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date() > invite.expiresAt) {
      return Response.json(
        { error: "Invite has expired" },
        { status: 410 }
      );
    }

    // Check if already used
    if (invite.usedAt) {
      return Response.json(
        { error: "Invite has already been used" },
        { status: 410 }
      );
    }

    // Verify email matches invite
    if (normalizedEmail !== invite.email.toLowerCase()) {
      return Response.json(
        { error: "Email does not match invite" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return Response.json(
        { error: "User already exists with this email" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hash(password, 10);
    const emailVerificationToken = crypto.randomUUID();
    const emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const now = new Date();

    // Claim invite and create user atomically to prevent double-submit races.
    const newUser = await prisma.$transaction(async (tx) => {
      const claimedInvite = await tx.tCInvite.updateMany({
        where: {
          id: invite.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (claimedInvite.count !== 1) {
        throw new Error("INVITE_UNAVAILABLE");
      }

      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          passwordHash,
          role: "TC",
          emailVerifiedAt: null,
          emailVerificationToken,
          emailVerificationExpiresAt,
        },
      });

      if (invite.invitedByUser.role === "REALTOR") {
        await tx.tCAgentLink.create({
          data: {
            tcUserId: user.id,
            agentUserId: invite.invitedByUserId,
            grantedBy: "REALTOR",
          },
        });
      }

      return user;
    });

    const verificationLink = `${appUrl}/verify-email?token=${encodeURIComponent(emailVerificationToken)}`;
    const verificationEmail = getAccountVerificationEmail(firstName.trim(), verificationLink);

    let verificationEmailSent = false;
    try {
      const verificationResult = await sendEmail({
        to: normalizedEmail,
        subject: verificationEmail.subject,
        html: verificationEmail.html,
      });
      verificationEmailSent = Boolean(verificationResult?.success);
      if (!verificationEmailSent) {
        console.warn(`[REGISTER_TC] Verification email skipped for ${normalizedEmail}`);
      }
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
    }

    return Response.json(
      {
        message: "TC account created successfully",
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role,
        },
        verificationRequired: true,
        verificationEmailSent,
        ...(verificationEmailSent
          ? {}
          : {
              warning:
                "TC account was created, but verification email was not delivered. Use password reset if needed.",
            }),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        { error: "User already exists with this email" },
        { status: 409 }
      );
    }

    if (error instanceof Error && error.message === "INVITE_UNAVAILABLE") {
      return Response.json(
        { error: "Invite has expired or already been used" },
        { status: 410 }
      );
    }

    console.error("TC registration error:", error);
    return Response.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
