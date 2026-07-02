import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/signs/mine - Get signs assigned to the current realtor
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.role !== "REALTOR" && user.role !== "TC") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    let realtorId = user.id as string;

    if (user.role === "TC") {
      const requestedRealtorId = searchParams.get("realtorId");

      if (!requestedRealtorId) {
        return Response.json(
          { error: "realtorId is required for TC sign access" },
          { status: 400 }
        );
      }

      const link = await prisma.tCAgentLink.findUnique({
        where: {
          tcUserId_agentUserId: {
            tcUserId: user.id,
            agentUserId: requestedRealtorId,
          },
        },
      });

      if (!link) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }

      realtorId = requestedRealtorId;
    }

    const signs = await prisma.sign.findMany({
      where: {
        assignedToUserId: realtorId,
        status: { in: ["DEPLOYED", "DAMAGED", "LOST"] },
      },
      include: {
        reports: {
          where: { resolvedAt: null },
          select: { id: true, type: true },
        },
      },
      orderBy: { signNumber: "asc" },
    });

    return Response.json({ signs });
  } catch (err) {
    console.error("Error fetching realtor's signs:", err);
    return Response.json({ error: "Failed to fetch signs" }, { status: 500 });
  }
}
