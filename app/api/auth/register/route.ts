import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { registerSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sendEmail, getAccountVerificationEmail, getWelcomeEmail } from "@/lib/email";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName, phone, brokerageName } = registerSchema.parse(body);
    const inviteToken = typeof body?.inviteToken === "string" ? body.inviteToken.trim() : "";

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
      role: "REALTOR" as const,
      ...(includeVerificationFields
        ? {
            emailVerificationToken,
            emailVerificationExpiresAt,
          }
        : {}),
    });

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

        let createdUser;
        try {
          createdUser = await tx.user.create({
            data: buildCreateData(true),
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          });
        } catch (createError) {
          if (!hasMissingVerificationColumn(createError)) {
            throw createError;
          }

          createdUser = await tx.user.create({
            data: buildCreateData(false),
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          });
        }

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
    } else {
      try {
        user = await prisma.user.create({
          data: buildCreateData(true),
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        });
      } catch (createError) {
        if (!hasMissingVerificationColumn(createError)) {
          throw createError;
        }

        user = await prisma.user.create({
          data: buildCreateData(false),
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        });
      }
    }

    const verificationLink = `${appUrl}/verify-email?token=${encodeURIComponent(emailVerificationToken)}`;
    const verificationEmail = getAccountVerificationEmail(firstName, verificationLink);

    try {
      await sendEmail({
        to: normalizedEmail,
        subject: verificationEmail.subject,
        html: verificationEmail.html,
      });
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
    }

    try {
      const welcomeEmail = getWelcomeEmail(firstName, `${appUrl}/login`);
      await sendEmail({
        to: normalizedEmail,
        subject: welcomeEmail.subject,
        html: welcomeEmail.html,
      });
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    return NextResponse.json({ ...user, verificationRequired: true }, { status: 201 });
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
