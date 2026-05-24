import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/admin/tcs/link - Link a TC to an agent
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { tcUserId, agentUserId } = await request.json();

    if (!tcUserId || !agentUserId) {
      return Response.json(
        { error: "tcUserId and agentUserId are required" },
        { status: 400 }
      );
    }

    // Verify TC exists and has role TC
    const tcUser = await prisma.user.findUnique({
      where: { id: tcUserId },
    });

    if (!tcUser || tcUser.role !== "TC") {
      return Response.json({ error: "TC user not found" }, { status: 404 });
    }

    // Verify agent exists and has role REALTOR
    const agentUser = await prisma.user.findUnique({
      where: { id: agentUserId },
    });

    if (!agentUser || agentUser.role !== "REALTOR") {
      return Response.json({ error: "Agent not found" }, { status: 404 });
    }

    // Check if link already exists
    const existingLink = await prisma.tCAgentLink.findUnique({
      where: { tcUserId_agentUserId: { tcUserId, agentUserId } },
    });

    if (existingLink) {
      return Response.json(
        { error: "Link already exists" },
        { status: 400 }
      );
    }

    // Create link
    const link = await prisma.tCAgentLink.create({
      data: {
        tcUserId,
        agentUserId,
        grantedBy: "ADMIN",
      },
      include: {
        tcUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        agentUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return Response.json(link, { status: 201 });
  } catch (err: any) {
    console.error("Error linking TC to agent:", err);
    if (err.code === "P2002") {
      return Response.json(
        { error: "Link already exists" },
        { status: 400 }
      );
    }
    return Response.json({ error: "Failed to link TC to agent" }, { status: 500 });
  }
}
