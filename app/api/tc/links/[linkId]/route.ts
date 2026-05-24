import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/tc/links/[linkId] - Revoke TC link
export async function DELETE(
  _request: Request,
  { params }: { params: { linkId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { linkId } = params;

    // Get the link to verify ownership
    const link = await prisma.tCAgentLink.findUnique({
      where: { id: linkId },
    });

    if (!link) {
      return Response.json({ error: "Link not found" }, { status: 404 });
    }

    // Verify the user is the agent (realtor) who granted this link
    if (link.agentUserId !== session.user.id) {
      console.warn(
        `Unauthorized revoke attempt: user ${session.user.id} tried to revoke link ${linkId}`
      );
      return Response.json(
        { error: "Unauthorized to revoke this link" },
        { status: 403 }
      );
    }

    // Delete the link
    await prisma.tCAgentLink.delete({
      where: { id: linkId },
    });

    return Response.json(
      { message: "Link revoked successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Revoke link error:", error);
    return Response.json(
      { error: "Failed to revoke link" },
      { status: 500 }
    );
  }
}
