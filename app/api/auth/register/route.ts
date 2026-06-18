import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { registerSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName, phone, brokerageName } = registerSchema.parse(body);
    const inviteToken = typeof body?.inviteToken === "string" ? body.inviteToken.trim() : "";

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

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

        const createdUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            firstName,
            lastName,
            phone,
            brokerageName,
            role: "REALTOR",
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        });

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
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          firstName,
          lastName,
          phone,
          brokerageName,
          role: "REALTOR",
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });
    }

    return NextResponse.json(user, { status: 201 });
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
