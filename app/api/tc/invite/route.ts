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
    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if TC with this email already exists
    const existingTC = await prisma.user.findUnique({ where: { email } });
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
        email,
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
    const tcInviteeName = email.split("@")[0]; // best guess; they'll set their real name on signup

    try {
      const emailTemplate = getRealtorInvitesTCEmail(
        tcInviteeName,
        inviterName,
        user.brokerageName ?? null,
        email,
        signupLink
      );
      await sendEmail({
        to: email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });
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
    if (email) {
      invites = await prisma.tCInvite.findMany({
        where: {
          email,
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
