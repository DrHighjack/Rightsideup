import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== "REALTOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = session.user.id;

    const [user, firstOrder, tcLink] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          isOnboarded: true,
          firstName: true,
          phone: true,
        },
      }),
      prisma.order.findFirst({
        where: { realtorId: userId },
        select: { id: true },
      }),
      prisma.tCAgentLink.findFirst({
        where: { agentUserId: userId },
        select: { id: true },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const hasProfile = user.phone !== null;
    const hasFirstOrder = Boolean(firstOrder);
    const hasTC = Boolean(tcLink);

    return NextResponse.json({
      isOnboarded: user.isOnboarded,
      hasProfile,
      hasFirstOrder,
      hasTC,
      profile: {
        firstName: user.firstName,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Failed to fetch onboarding status:", error);
    return NextResponse.json(
      { error: "Failed to fetch onboarding status" },
      { status: 500 }
    );
  }
}