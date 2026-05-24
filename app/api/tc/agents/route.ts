import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/tc/agents - List agents this TC is linked to
export async function GET(_request: Request) {
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
        { error: "Only TCs can access agents list" },
        { status: 403 }
      );
    }

    // Get all agents this TC is linked to
    const links = await prisma.tCAgentLink.findMany({
      where: { tcUserId: session.user.id },
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
    });

    const agents = links.map((link) => ({
      linkId: link.id,
      agentId: link.agentUser.id,
      firstName: link.agentUser.firstName,
      lastName: link.agentUser.lastName,
      email: link.agentUser.email,
      brokerageName: link.agentUser.brokerageName,
      grantedBy: link.grantedBy,
    }));

    return Response.json({ agents });
  } catch (error) {
    console.error("Get agents error:", error);
    return Response.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}
