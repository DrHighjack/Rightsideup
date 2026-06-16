import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/users/search?query=...&role=... - Search for users by name or email
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const roleParam = searchParams.get("role"); // "TC" or "REALTOR"

    if (!query || query.length < 2) {
      return Response.json({ users: [] });
    }

    // Validate role parameter
    const validRoles = ["TC", "REALTOR"];
    const role = roleParam && validRoles.includes(roleParam) ? roleParam : undefined;

    // Search by name or email
    const users = await prisma.user.findMany({
      where: {
        ...(role && { role: role as any }),
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
      take: 20,
    });

    return Response.json({ users });
  } catch (err) {
    console.error("Error searching users:", err);
    return Response.json({ error: "Failed to search users" }, { status: 500 });
  }
}
