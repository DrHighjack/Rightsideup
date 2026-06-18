import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
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

export async function GET(request: NextRequest) {
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

      await prisma.tCAgentLink.upsert({
        where: {
          tcUserId_agentUserId: {
            tcUserId: tcUser.id,
            agentUserId: existingUser.id,
          },
        },
        update: {},
        create: {
          tcUserId: tcUser.id,
          agentUserId: existingUser.id,
          grantedBy: "TC",
        },
      });

      const loginLink = `${baseUrl}/login`;
      const invitationEmail = getTCInvitationEmail(
        `${existingUser.firstName} ${existingUser.lastName}`,
        tcName,
        tcUser.email,
        loginLink
      );

      const welcomeHtml = `
        <p>Hi ${existingUser.firstName},</p>
        <p>Welcome to RightSignUP. ${tcName} has invited you to collaborate so your sign can be placed faster.</p>
        <p>Please complete your registration by logging in and confirming your account details.</p>
        <p><a href="${loginLink}">Go to Login</a></p>
      `;

      await Promise.all([
        sendEmail({ to: existingUser.email, subject: invitationEmail.subject, html: invitationEmail.html }),
        sendEmail({
          to: existingUser.email,
          subject: "Welcome to RightSignUP - Complete Your Registration",
          html: welcomeHtml,
        }),
      ]).catch((error) => {
        console.warn("Failed to send one or more realtor onboarding emails:", error);
      });

      return NextResponse.json({
        linked: true,
        invited: false,
        realtor: {
          id: existingUser.id,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          email: existingUser.email,
          brokerageName: existingUser.brokerageName,
        },
      });
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
      <p>Welcome to RightSignUP. ${tcName} is inviting you to the platform so your sign can be placed.</p>
      <p>Please complete your registration using this link:</p>
      <p><a href="${signupLink}">${signupLink}</a></p>
    `;

    await Promise.all([
      sendEmail({ to: email, subject: invitationEmail.subject, html: invitationEmail.html }),
      sendEmail({
        to: email,
        subject: "Welcome to RightSignUP - Complete Your Registration",
        html: welcomeHtml,
      }),
    ]).catch((error) => {
      console.warn("Failed to send one or more realtor invitation emails:", error);
    });

    return NextResponse.json({
      linked: false,
      invited: true,
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