import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { registerSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sendEmail, getAccountVerificationEmail, getWelcomeEmail } from "@/lib/email";
import { buildSmsConsentData } from "@/lib/sms-consent";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  "https://app.northshoresignco.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountType, email, password, firstName, lastName, phone, brokerageName, smsOptIn } = registerSchema.parse(body);
    const inviteToken = typeof body?.inviteToken === "string" ? body.inviteToken.trim() : "";

    if (inviteToken && accountType !== "REALTOR") {
      return NextResponse.json({ error: "Invitations are only valid for Realtor registration" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const emailVerificationToken = crypto.randomUUID();
    const emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const hasMissingVerificationColumn = (error: unknown) =>
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2022" &&
      ["emailVerificationToken", "emailVerificationExpiresAt", "emailVerifiedAt"].some((column) =>
        String((error.meta as any)?.column || "").includes(column)
      );

    const buildCreateData = (includeVerificationFields: boolean) => ({
      email: normalizedEmail,
      passwordHash,
      firstName,
      lastName,
      phone,
      brokerageName,
      role: accountType,
      accountStatus: accountType === "REALTOR" ? "ACTIVE" as const : "PENDING_APPROVAL" as const,
      ...buildSmsConsentData(phone, smsOptIn),
      ...(includeVerificationFields
        ? {
            emailVerificationToken,
            emailVerificationExpiresAt,
          }
        : {}),
    });

    const createUser = async (client: Pick<Prisma.TransactionClient, "user">) => {
      const select = {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        accountStatus: true,
      } as const;

      try {
        return await client.user.create({ data: buildCreateData(true), select });
      } catch (createError) {
        if (!hasMissingVerificationColumn(createError)) {
          throw createError;
        }

        return client.user.create({ data: buildCreateData(false), select });
      }
    };

    let user;

    if (inviteToken) {
      const invite = await prisma.tCInvite.findUnique({
        where: { token: inviteToken },
        include: {
          invitedByUser: {
            select: { id: true, role: true },
          },
        },
      });

      if (!invite) {
        return NextResponse.json({ error: "Invalid invite token" }, { status: 404 });
      }

      if (invite.usedAt) {
        return NextResponse.json({ error: "Invite has already been used" }, { status: 410 });
      }

      if (new Date() > invite.expiresAt) {
        return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
      }

      if (invite.invitedByUser.role !== "TC") {
        return NextResponse.json(
          { error: "This invite token is not valid for realtor registration" },
          { status: 400 }
        );
      }

      if (invite.email.toLowerCase() !== normalizedEmail) {
        return NextResponse.json(
          { error: "Email does not match invite" },
          { status: 400 }
        );
      }

      const now = new Date();

      user = await prisma.$transaction(async (tx) => {
        const claimed = await tx.tCInvite.updateMany({
          where: {
            id: invite.id,
            usedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now },
        });

        if (claimed.count !== 1) {
          throw new Error("INVITE_UNAVAILABLE");
        }

        const createdUser = await createUser(tx);

        await tx.tCAgentLink.upsert({
          where: {
            tcUserId_agentUserId: {
              tcUserId: invite.invitedByUserId,
              agentUserId: createdUser.id,
            },
          },
          update: {},
          create: {
            tcUserId: invite.invitedByUserId,
            agentUserId: createdUser.id,
            grantedBy: "TC",
          },
        });

        return createdUser;
      });
    } else if (accountType === "BROKERAGE") {
      user = await prisma.$transaction(async (tx) => {
        const createdUser = await createUser(tx);
        const brokerage = await tx.brokerage.create({
          data: {
            name: brokerageName!.trim(),
            phone: phone || null,
            email: normalizedEmail,
            billingType: "BROKERAGE",
            isActive: false,
            adminId: createdUser.id,
          },
          select: { id: true },
        });

        return tx.user.update({
          where: { id: createdUser.id },
          data: { brokerageId: brokerage.id },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            accountStatus: true,
          },
        });
      });
    } else {
      user = await createUser(prisma);
    }

    const verificationLink = `${appUrl}/verify-email?token=${encodeURIComponent(emailVerificationToken)}`;
    const verificationEmail = getAccountVerificationEmail(firstName, verificationLink);

    let verificationEmailSent = false;
    let welcomeEmailSent = false;

    try {
      const verificationResult = await sendEmail({
        to: normalizedEmail,
        subject: verificationEmail.subject,
        html: verificationEmail.html,
      });
      verificationEmailSent = Boolean(verificationResult?.success);
      if (!verificationEmailSent) {
        console.warn(`[REGISTER] Verification email skipped for ${normalizedEmail}`);
      }
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
    }

    try {
      if (user.accountStatus !== "ACTIVE") {
        return NextResponse.json(
          {
            ...user,
            verificationRequired: true,
            verificationEmailSent,
            accountApprovalRequired: true,
            message: "Your account request was received and is awaiting admin approval and activation.",
          },
          { status: 201 }
        );
      }

      const welcomeEmail = getWelcomeEmail(firstName, `${appUrl}/login`);
      const welcomeResult = await sendEmail({
        to: normalizedEmail,
        subject: welcomeEmail.subject,
        html: welcomeEmail.html,
      });
      welcomeEmailSent = Boolean(welcomeResult?.success);
      if (!welcomeEmailSent) {
        console.warn(`[REGISTER] Welcome email skipped for ${normalizedEmail}`);
      }
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    return NextResponse.json(
      {
        ...user,
        verificationRequired: true,
        verificationEmailSent,
        welcomeEmailSent,
        ...(verificationEmailSent && welcomeEmailSent
          ? {}
          : {
              warning:
                "Your account was created, but one or more emails were not delivered. Please use password reset if needed.",
            }),
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "INVITE_UNAVAILABLE") {
      return NextResponse.json(
        { error: "Invite has expired or already been used" },
        { status: 410 }
      );
    }

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
