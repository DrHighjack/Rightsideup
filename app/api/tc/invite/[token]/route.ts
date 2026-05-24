import { prisma } from "@/lib/prisma";

// GET /api/tc/invite/[token] - Validate and retrieve invite by token
export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return Response.json({ error: "Token is required" }, { status: 400 });
    }

    const invite = await prisma.tCInvite.findUnique({
      where: { token },
      include: {
        invitedByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!invite) {
      return Response.json({ error: "Invalid invite token" }, { status: 404 });
    }

    // Check if expired
    if (new Date() > invite.expiresAt) {
      return Response.json({ error: "Invite has expired" }, { status: 410 });
    }

    // Check if already used
    if (invite.usedAt) {
      return Response.json(
        { error: "Invite has already been used" },
        { status: 410 }
      );
    }

    return Response.json({
      id: invite.id,
      email: invite.email,
      token: invite.token,
      expiresAt: invite.expiresAt,
      invitedByUser: invite.invitedByUser,
    });
  } catch (error) {
    console.error("TC invite validation error:", error);
    return Response.json(
      { error: "Failed to validate invite" },
      { status: 500 }
    );
  }
}
