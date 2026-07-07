import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (role !== "REALTOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { vaultId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ hasCard: Boolean(user.vaultId) });
  } catch (error) {
    console.error("Failed to check card-on-file:", error);
    return NextResponse.json({ error: "Failed to check card on file" }, { status: 500 });
  }
}
