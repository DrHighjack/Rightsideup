import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { parseInventoryPriceServiceType } from "@/lib/pricing";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const masterPrices = await prisma.masterPrice.findMany({
      orderBy: { serviceType: "asc" },
    });

    return NextResponse.json({ masterPrices });
  } catch (error) {
    console.error("Error fetching master prices:", error);
    return NextResponse.json(
      { error: "Failed to fetch master prices" },
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

    const { serviceType, amountCents } = await request.json();

    if (!serviceType || amountCents === undefined) {
      return NextResponse.json(
        { error: "serviceType and amountCents are required" },
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
    const { updateMasterPrice } = await import("@/lib/pricing");

    // This updates the master price AND cascades to unlocked overrides
    await updateMasterPrice(serviceType, amountCents);

    // Keep inventory pricing in sync when this is an inventory-backed service key.
    const inventoryItemId = parseInventoryPriceServiceType(serviceType);
    if (inventoryItemId) {
      await prisma.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { pricePerUnit: amountCents },
      });
    }

    // Fetch the updated master price
    const masterPrice = await prisma.masterPrice.findUnique({
      where: { serviceType },
    });

    return NextResponse.json(
      { masterPrice, message: "Master price updated and cascaded to unlocked overrides" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating master price:", error);
    return NextResponse.json(
      { error: "Failed to update master price" },
      { status: 500 }
    );
  }
}
