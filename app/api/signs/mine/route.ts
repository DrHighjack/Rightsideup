import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/signs/mine - Get signs assigned to the current realtor
export async function GET(_request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.role !== "REALTOR" && user.role !== "TC") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const realtorId = user.id;

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
