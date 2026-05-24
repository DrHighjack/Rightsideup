import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/signs/map - Get signs with location data for map view
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
    // Get all signs with location data and related info
    const signs = await prisma.sign.findMany({
      where: {
        deployedLat: { not: null },
        deployedLng: { not: null },
      },
      select: {
        id: true,
        signNumber: true,
        type: true,
        status: true,
        deployedAddress: true,
        deployedLat: true,
        deployedLng: true,
        assignedToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedToOrder: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
        reports: {
          where: { resolvedAt: null },
          select: {
            id: true,
            type: true,
          },
        },
      },
    });

    return Response.json({ signs });
  } catch (err) {
    console.error("Error fetching signs for map:", err);
    return Response.json({ error: "Failed to fetch signs for map" }, { status: 500 });
  }
}
