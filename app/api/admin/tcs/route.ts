import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/tcs - Get all TC accounts with agent links and stats
export async function GET(_request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get all TC users with their agent links
    const tcs = await prisma.user.findMany({
      where: { role: "TC" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        tags: true,
        createdAt: true,
        tcAgentLinks: {
          select: {
            id: true,
            agentUserId: true,
            agentUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Format response with agent count
    const formattedTcs = tcs.map((tc) => ({
      id: tc.id,
      firstName: tc.firstName,
      lastName: tc.lastName,
      email: tc.email,
      phone: tc.phone,
      agentCount: tc.tcAgentLinks.length,
      linkedAgentCount: tc.tcAgentLinks.length,
      isActive: !tc.tags.includes("INACTIVE"),
      agents: tc.tcAgentLinks.map((link) => ({
        linkId: link.id,
        agentId: link.agentUserId,
        ...link.agentUser,
      })),
      createdAt: tc.createdAt,
    }));

    return Response.json({ tcs: formattedTcs });
  } catch (err) {
    console.error("Error fetching TCs:", err);
    return Response.json({ error: "Failed to fetch TCs" }, { status: 500 });
  }
}
