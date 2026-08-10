import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { adminPricingOverrideCreateSchema } from "@/lib/schemas";
import { ZodError } from "zod";

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

    const { serviceType, amountCents, userId, brokerageId, isLocked } =
      adminPricingOverrideCreateSchema.parse(await request.json());

    // Import the pricing helper
    const { setPriceOverride } = await import("@/lib/pricing");

    await setPriceOverride(serviceType, amountCents, userId, brokerageId, isLocked);

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
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }
    console.error("Error creating price override:", error);
    return NextResponse.json(
      { error: "Failed to create price override" },
      { status: 500 }
    );
  }
}
