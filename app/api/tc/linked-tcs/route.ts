import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/tc/linked-tcs - Get TCs linked to this realtor/agent
export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;

  // Only realtors and admins can see their linked TCs
  if (user.role !== "REALTOR" && user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get all TCs linked to this agent
    const linkedTCs = await prisma.tCAgentLink.findMany({
      where: { agentUserId: user.id },
      include: {
        tcUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Transform to match expected format
    const formatted = linkedTCs.map((link) => ({
      linkId: link.id,
      tcId: link.tcUser.id,
      firstName: link.tcUser.firstName,
      lastName: link.tcUser.lastName,
      email: link.tcUser.email,
      grantedBy: link.grantedBy,
    }));

    return Response.json({ linkedTCs: formatted });
  } catch (err) {
    console.error("Error fetching linked TCs:", err);
    return Response.json(
      { error: "Failed to fetch linked TCs" },
      { status: 500 }
    );
  }
}
