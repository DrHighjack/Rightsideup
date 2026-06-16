import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const overrides = await prisma.priceOverride.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        brokerage: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { serviceType: "asc" },
    });

    return NextResponse.json({ overrides });
  } catch (error) {
    console.error("Error fetching price overrides:", error);
    return NextResponse.json(
      { error: "Failed to fetch price overrides" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { serviceType, amountCents, userId, brokerageId } =
      await request.json();

    if (!serviceType || amountCents === undefined) {
      return NextResponse.json(
        { error: "serviceType and amountCents are required" },
        { status: 400 }
      );
    }

    if (!userId && !brokerageId) {
      return NextResponse.json(
        { error: "Either userId or brokerageId must be provided" },
        { status: 400 }
      );
    }

    if (userId && brokerageId) {
      return NextResponse.json(
        { error: "Cannot set both userId and brokerageId" },
        { status: 400 }
      );
    }

    if (typeof amountCents !== "number" || amountCents < 0) {
      return NextResponse.json(
        { error: "amountCents must be a non-negative number" },
        { status: 400 }
      );
    }

    // Import the pricing helper
    const { setPriceOverride } = await import("@/lib/pricing");

    await setPriceOverride(serviceType, amountCents, userId, brokerageId);

    // Fetch the created/updated override
    let override;
    if (userId) {
      override = await prisma.priceOverride.findUnique({
        where: {
          serviceType_userId: { serviceType, userId },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          brokerage: true,
        },
      });
    } else {
      override = await prisma.priceOverride.findUnique({
        where: {
          serviceType_brokerageId: { serviceType, brokerageId },
        },
        include: {
          user: true,
          brokerage: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }

    return NextResponse.json({ override }, { status: 200 });
  } catch (error) {
    console.error("Error creating price override:", error);
    return NextResponse.json(
      { error: "Failed to create price override" },
      { status: 500 }
    );
  }
}
