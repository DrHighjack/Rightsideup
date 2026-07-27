import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { sendEmail, getTCInvitationEmail } from "@/lib/email";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getBaseUrl(request: NextRequest): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    `${request.nextUrl.protocol}//${request.nextUrl.host}`
  );
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tcUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    });

    if (!tcUser || tcUser.role !== "TC") {
      return NextResponse.json({ error: "Only TCs can access this route" }, { status: 403 });
    }

    const [links, pendingInvites] = await Promise.all([
      prisma.tCAgentLink.findMany({
        where: { tcUserId: tcUser.id },
        include: {
          agentUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              brokerageName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.tCInvite.findMany({
        where: {
          invitedByUserId: tcUser.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      realtors: links.map((link) => ({
        linkId: link.id,
        id: link.agentUser.id,
        firstName: link.agentUser.firstName,
        lastName: link.agentUser.lastName,
        email: link.agentUser.email,
        brokerageName: link.agentUser.brokerageName,
      })),
      pendingInvites: pendingInvites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        expiresAt: invite.expiresAt,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch TC realtors:", error);
    return NextResponse.json({ error: "Failed to fetch realtors" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tcUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, firstName: true, lastName: true, email: true },
    });

    if (!tcUser || tcUser.role !== "TC") {
      return NextResponse.json({ error: "Only TCs can add realtors" }, { status: 403 });
    }

    const body = await request.json();
    const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
    const rawEmail = typeof body?.email === "string" ? body.email : "";
    const email = normalizeEmail(rawEmail);

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "First name, last name, and email are required" },
        { status: 400 }
      );
    }

    if (!z.string().email().safeParse(email).success) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    const tcName = `${tcUser.firstName} ${tcUser.lastName}`.trim();
    const baseUrl = getBaseUrl(request);

    if (existingUser) {
      if (existingUser.role !== "REALTOR") {
        return NextResponse.json(
          { error: "A non-realtor account already exists with this email" },
          { status: 409 }
        );
      }

      const existingLink = await prisma.tCAgentLink.findUnique({
        where: {
          tcUserId_agentUserId: {
            tcUserId: tcUser.id,
            agentUserId: existingUser.id,
          },
        },
      });

      return NextResponse.json(
        {
          error: existingLink
            ? "This realtor is already linked to your account"
            : "This realtor already has an account. Their approval is required before they can be linked.",
        },
        { status: 409 }
      );
    }

    const existingInvite = await prisma.tCInvite.findFirst({
      where: {
        invitedByUserId: tcUser.id,
        email,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "An invitation for this email is already pending" },
        { status: 409 }
      );
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await prisma.tCInvite.create({
      data: {
        email,
        token,
        expiresAt,
        invitedByUserId: tcUser.id,
      },
    });

    const signupLink = `${baseUrl}/register?inviteToken=${token}`;
    const invitationEmail = getTCInvitationEmail(
      `${firstName} ${lastName}`,
      tcName,
      tcUser.email,
      signupLink
    );

    const welcomeHtml = `
      <p>Hi ${firstName},</p>
      <p>Welcome to North Shore Sign Co. ${tcName} is inviting you to the platform so your sign can be placed.</p>
      <p>Please complete your registration using this link:</p>
      <p><a href="${signupLink}">${signupLink}</a></p>
    `;

    let emailSent = false;
    let emailSkipped = false;
    let emailStatusCodes: Array<number | null> = [];
    let emailMessageIds: Array<string | null> = [];
    try {
      const sendResults = await Promise.all([
        sendEmail({ to: email, subject: invitationEmail.subject, html: invitationEmail.html }),
        sendEmail({
          to: email,
          subject: "Welcome to North Shore Sign Co - Complete Your Registration",
          html: welcomeHtml,
        }),
      ]);

      emailSent = sendResults.every((result) => Boolean(result?.success));
      emailSkipped = sendResults.some((result) => Boolean((result as any)?.skipped));
      emailStatusCodes = sendResults.map((result) => result?.statusCode ?? null);
      emailMessageIds = sendResults.map((result) => result?.messageId ?? null);
      if (emailSent) {
        console.log(
          `[TC_REALTOR_INVITE] Emails accepted for ${email} (statuses=${emailStatusCodes.map((code) => code ?? "unknown").join(",")}, messageIds=${emailMessageIds.map((id) => id ?? "n/a").join(",")})`
        );
      } else if (emailSkipped) {
        console.warn(`[TC_REALTOR_INVITE] One or more emails skipped for ${email} (Brevo not configured).`);
      }
    } catch (error) {
      console.warn("Failed to send one or more realtor invitation emails:", error);
    }

    return NextResponse.json({
      linked: false,
      invited: true,
      emailSent,
      emailSkipped,
      emailStatusCodes,
      emailMessageIds,
      ...(emailSent
        ? {}
        : {
            warning:
              "Invite record was created, but one or more emails failed to send. Share the invite link manually.",
          }),
      pendingInvite: {
        id: invite.id,
        email: invite.email,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    console.error("Failed to add realtor for TC:", error);
    return NextResponse.json({ error: "Failed to add realtor" }, { status: 500 });
  }
}