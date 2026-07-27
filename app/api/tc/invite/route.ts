import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { sendEmail, getRealtorInvitesTCEmail } from "@/lib/email";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// POST /api/tc/invite - Create a TC invite
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || (user.role !== "ADMIN" && user.role !== "REALTOR")) {
      return Response.json(
        { error: "Only admins and realtors can invite TCs" },
        { status: 403 }
      );
    }

    const { email } = await request.json();
    if (typeof email !== "string" || !email.trim()) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if TC with this email already exists
    const existingTC = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingTC?.role === "TC") {
      return Response.json(
        { error: "TC already registered with this email" },
        { status: 409 }
      );
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const invite = await prisma.tCInvite.create({
      data: {
        email: normalizedEmail,
        token,
        expiresAt,
        invitedByUserId: session.user.id,
      },
    });

    // Send invitation email to the TC invitee
    const signupLink = `${appUrl}/register/tc?token=${token}`;
    const inviterName = user.firstName
      ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
      : user.email;
    const tcInviteeName = normalizedEmail.split("@")[0]; // best guess; they'll set their real name on signup

    let emailSent = false;
    let emailStatusCode: number | null = null;
    let emailMessageId: string | null = null;
    try {
      const emailTemplate = getRealtorInvitesTCEmail(
        tcInviteeName,
        inviterName,
        user.brokerageName ?? null,
        normalizedEmail,
        signupLink
      );
      const sendResult = await sendEmail({
        to: normalizedEmail,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });
      emailSent = true;
      emailStatusCode = sendResult?.statusCode ?? null;
      emailMessageId = sendResult?.messageId ?? null;
      console.log(
        `[TC_INVITE] Email accepted for ${normalizedEmail} (status=${emailStatusCode ?? "unknown"}, messageId=${emailMessageId ?? "n/a"})`
      );
    } catch (emailError) {
      console.error("Failed to send TC invite email:", emailError);
      // Non-fatal — the invite record exists; inviter can share the link manually
    }

    return Response.json(
      {
        id: invite.id,
        email: invite.email,
        token: invite.token,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
        emailSent,
        emailStatusCode,
        emailMessageId,
        ...(emailSent
          ? {}
          : {
              warning:
                "Invite record was created, but the email could not be sent. Share the invite link manually.",
            }),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("TC invite creation error:", error);
    return Response.json(
      { error: "Failed to create invite" },
      { status: 500 }
    );
  }
}

// GET /api/tc/invite?email=... - List sent invites (admin/realtor only)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || (user.role !== "ADMIN" && user.role !== "REALTOR")) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const email = url.searchParams.get("email");

    let invites;
    const pendingWhere = {
      usedAt: null,
      expiresAt: { gt: new Date() },
    };
    if (email) {
      invites = await prisma.tCInvite.findMany({
        where: {
          ...pendingWhere,
          email: email.trim().toLowerCase(),
          invitedByUserId: user.role === "ADMIN" ? undefined : session.user.id,
        },
        include: {
          invitedByUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });
    } else {
      invites = await prisma.tCInvite.findMany({
        where: {
          ...pendingWhere,
          invitedByUserId: user.role === "ADMIN" ? undefined : session.user.id,
        },
        include: {
          invitedByUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }

    return Response.json({ invites });
  } catch (error) {
    console.error("TC invite fetch error:", error);
    return Response.json(
      { error: "Failed to fetch invites" },
      { status: 500 }
    );
  }
}
