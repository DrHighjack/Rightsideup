import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/admin/tcs/link/[id] - Unlink a TC from an agent
export async function DELETE(
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
    const linkId = params.id;

    // Find and verify link exists
    const link = await prisma.tCAgentLink.findUnique({
      where: { id: linkId },
    });

    if (!link) {
      return Response.json({ error: "Link not found" }, { status: 404 });
    }

    // Delete link
    await prisma.tCAgentLink.delete({
      where: { id: linkId },
    });

    return Response.json({ message: "Link deleted successfully" });
  } catch (err) {
    console.error("Error unlinking TC from agent:", err);
    return Response.json(
      { error: "Failed to unlink TC from agent" },
      { status: 500 }
    );
  }
}
