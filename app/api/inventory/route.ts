import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const signs = await prisma.sign.findMany({
      where: {
        status: "AVAILABLE",
        assignedToOrderId: null,
      },
      orderBy: { type: "asc" },
    });

    // Group signs by type to create inventory structure
    const inventoryMap: Record<string, any> = {};

    signs.forEach((sign) => {
      const typeKey = sign.type || "Standard";
      if (!inventoryMap[typeKey]) {
        inventoryMap[typeKey] = {
          id: typeKey.replace(/\s+/g, "_").toLowerCase(),
          name: typeKey,
          description: `${typeKey} Sign`,
          inventory: [],
          signs: [],
        };
      }
      inventoryMap[typeKey].inventory.push({
        quantity: 1,
        location: sign.deployedAddress || "Storage",
        signNumber: sign.signNumber,
      });
      inventoryMap[typeKey].signs.push(sign.id);
    });

    const signsByType = Object.values(inventoryMap);

    return NextResponse.json({ signs: signsByType });
  } catch (error) {
    console.error("Inventory fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
