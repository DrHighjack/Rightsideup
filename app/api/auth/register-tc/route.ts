import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

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

    // Validate invite
    const invite = await prisma.tCInvite.findUnique({
      where: { token: inviteToken },
    });

    if (!invite) {
      return Response.json({ error: "Invalid invite token" }, { status: 404 });
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
    if (email !== invite.email) {
      return Response.json(
        { error: "Email does not match invite" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return Response.json(
        { error: "User already exists with this email" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hash(password, 10);

    // Create TC user within transaction
    const [newUser, _] = await Promise.all([
      prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          passwordHash,
          role: "TC",
        },
      }),
      // Mark invite as used
      prisma.tCInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      }),
    ]);

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
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("TC registration error:", error);
    return Response.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
