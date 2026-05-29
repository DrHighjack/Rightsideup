import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

interface OrderMapData {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  address: string;
  addressLat: number | null;
  addressLng: number | null;
  realtor: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  scheduledDate: string | null;
}

/**
 * GET /api/admin/orders/map
 * Get all orders with coordinates for map display
 * Only accessible to ADMIN
 */
export async function GET() {
  try {
    const session = await auth();

    // Check authentication
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all orders with coordinates
    const orders = await prisma.order.findMany({
      where: {
        // Only show orders that have coordinates (geocoded)
        addressLat: {
          not: null,
        },
        addressLng: {
          not: null,
        },
      },
      select: {
        id: true,
        orderNumber: true,
        type: true,
        status: true,
        address: true,
        addressLat: true,
        addressLng: true,
        realtor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdAt: true,
        scheduledDate: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform data for map display
    const mapData: OrderMapData[] = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      type: order.type,
      status: order.status,
      address: order.address,
      addressLat: order.addressLat,
      addressLng: order.addressLng,
      realtor: order.realtor,
      createdAt: order.createdAt.toISOString(),
      scheduledDate: order.scheduledDate?.toISOString() || null,
    }));

    return NextResponse.json({
      orders: mapData,
      total: mapData.length,
    });
  } catch (error) {
    console.error("Error fetching orders for map:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
