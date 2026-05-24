import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/tc/set-agent - Set active agent context
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || user.role !== "TC") {
      return Response.json(
        { error: "Only TCs can set agent context" },
        { status: 403 }
      );
    }

    const { agentId } = await request.json();
    if (!agentId) {
      return Response.json(
        { error: "agentId is required" },
        { status: 400 }
      );
    }

    // ===== CRITICAL VALIDATION =====
    // Verify the TCAgentLink exists - this is the security checkpoint
    const link = await prisma.tCAgentLink.findUnique({
      where: {
        tcUserId_agentUserId: {
          tcUserId: session.user.id,
          agentUserId: agentId,
        },
      },
      include: {
        agentUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!link) {
      console.warn(
        `TC ${session.user.id} attempted to access agent ${agentId} without authorization`
      );
      return Response.json(
        { error: "Not linked to this agent" },
        { status: 403 }
      );
    }

    // Verify agent user exists and is REALTOR
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
    });

    if (!agent || agent.role !== "REALTOR") {
      return Response.json(
        { error: "Invalid agent" },
        { status: 404 }
      );
    }

    // ===== END CRITICAL VALIDATION =====
    // Validation passed - return success with agent details
    // Client will store activeAgentId in session/localStorage

    return Response.json(
      {
        message: "Agent context set successfully",
        activeAgent: {
          id: link.agentUser.id,
          firstName: link.agentUser.firstName,
          lastName: link.agentUser.lastName,
          email: link.agentUser.email,
        },
        tcId: session.user.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Set agent error:", error);
    return Response.json(
      { error: "Failed to set agent context" },
      { status: 500 }
    );
  }
}
