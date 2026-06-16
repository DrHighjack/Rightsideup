import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Fetch all orders for this realtor
    const orders = await prisma.order.findMany({
      where: { realtorId: id },
      select: {
        id: true,
        orderNumber: true,
        type: true,
        status: true,
        address: true,
        createdAt: true,
        scheduledDate: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Error fetching realtor orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch realtor orders" },
      { status: 500 }
    );
  }
}
