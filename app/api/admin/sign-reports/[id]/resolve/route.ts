import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/admin/sign-reports/[id]/resolve - Mark a report as resolved
export async function PUT(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const report = await prisma.signReport.update({
      where: { id: params.id },
      data: { resolvedAt: new Date() },
      include: {
        sign: true,
        reportedByUser: true,
      },
    });

    return Response.json(report);
  } catch (err) {
    console.error("Error resolving report:", err);
    return Response.json({ error: "Failed to resolve report" }, { status: 500 });
  }
}
