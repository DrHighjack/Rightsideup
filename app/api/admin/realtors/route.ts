import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/realtors - Get all realtors for assignment
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
    const realtors = await prisma.user.findMany({
      where: { role: "REALTOR" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: { firstName: "asc" },
    });

    return Response.json({ realtors });
  } catch (err) {
    console.error("Error fetching realtors:", err);
    return Response.json({ error: "Failed to fetch realtors" }, { status: 500 });
  }
}
