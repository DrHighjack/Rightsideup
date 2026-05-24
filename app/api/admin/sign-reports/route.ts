import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/sign-reports - Get all open sign reports
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const resolved = url.searchParams.get("resolved");

  try {
    const where: any = {};
    
    if (resolved === "true") {
      where.resolvedAt = { not: null };
    } else if (resolved === "false") {
      where.resolvedAt = null;
    }

    const reports = await prisma.signReport.findMany({
      where,
      include: {
        sign: {
          select: {
            id: true,
            signNumber: true,
            type: true,
            status: true,
            deployedAddress: true,
          },
        },
        reportedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ reports });
  } catch (err) {
    console.error("Error fetching sign reports:", err);
    return Response.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}
