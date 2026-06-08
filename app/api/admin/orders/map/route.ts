import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { createAuthenticatedCachedResponse } from "@/lib/cache-response";

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
  photoData?: string | null; // Base64 encoded first photo
  photoName?: string | null; // Name of first photo
}

/**
 * GET /api/admin/orders/map
 * Get all orders with coordinates for map display
 * Only accessible to ADMIN
 */
// Cache map data for 60 seconds (same as dashboard)
export const revalidate = 60;

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
        jobAssignment: {
          select: {
            images: true,
            completedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform data for map display
    const mapData: OrderMapData[] = orders.map((order) => {
      // Get first photo from job assignment if it's completed
      let photoData: string | null = null;
      let photoName: string | null = null;

      try {
        if (order.jobAssignment && order.jobAssignment.completedAt) {
          const images = order.jobAssignment.images as any;
          if (images && Array.isArray(images) && images.length > 0) {
            const firstImage = images[0];
            if (firstImage && typeof firstImage === 'object') {
              photoData = (firstImage as any).data || null;
              photoName = (firstImage as any).name || null;
            }
          }
        }
      } catch (imgErr) {
        console.warn(`Error processing images for order ${order.id}:`, imgErr);
        // Continue without photo data
      }

      return {
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
        photoData,
        photoName,
      };
    });

    return createAuthenticatedCachedResponse(
      {
        orders: mapData,
        total: mapData.length,
      },
      60 // Cache for 60 seconds
    );
  } catch (error) {
    console.error("Error fetching orders for map:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
