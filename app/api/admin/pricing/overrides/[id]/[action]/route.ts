import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(
  _: Request,
  { params }: { params: { id: string; action: string } }
) {
  try {
    const session = await auth();

    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, action } = params;

    // Verify the override exists
    const override = await prisma.priceOverride.findUnique({
      where: { id },
    });

    if (!override) {
      return NextResponse.json(
        { error: "Price override not found" },
        { status: 404 }
      );
    }

    let updated;

    if (action === "lock") {
      updated = await prisma.priceOverride.update({
        where: { id },
        data: { isLocked: true, updatedAt: new Date() },
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
      });
    } else if (action === "unlock") {
      updated = await prisma.priceOverride.update({
        where: { id },
        data: { isLocked: false, updatedAt: new Date() },
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
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'lock' or 'unlock'" },
        { status: 400 }
      );
    }

    return NextResponse.json({ override: updated }, { status: 200 });
  } catch (error) {
    console.error("Error updating override lock status:", error);
    return NextResponse.json(
      { error: "Failed to update override lock status" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: { id: string; action: string } }
) {
  try {
    const session = await auth();

    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, action } = params;

    if (action !== "delete") {
      return NextResponse.json(
        { error: "Invalid action for DELETE" },
        { status: 400 }
      );
    }

    // Verify the override exists
    const override = await prisma.priceOverride.findUnique({
      where: { id },
    });

    if (!override) {
      return NextResponse.json(
        { error: "Price override not found" },
        { status: 404 }
      );
    }

    await prisma.priceOverride.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Price override deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting price override:", error);
    return NextResponse.json(
      { error: "Failed to delete price override" },
      { status: 500 }
    );
  }
}
