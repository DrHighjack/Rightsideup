import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/salesmen/stats
 * Get statistics for a specific salesman
 * Shows number of clients added, installs allocated, orders, revenue, etc.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || !["ADMIN", "SALESMEN"].includes((session.user as any).role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const salesmenId = session.user.id;

    // Get all clients added by this salesman
    const clientsAdded = await prisma.user.findMany({
      where: {
        role: "REALTOR",
        freeInstallGivenBy: salesmenId,
      },
      include: {
        orders: {
          include: {
            items: true,
            discounts: true,
          },
        },
      },
    });

    // Calculate statistics
    const stats = {
      totalClientsAdded: clientsAdded.length,
      clientsWithInstalls: clientsAdded.filter((c) => c.freeInstallGivenBy).length,
      totalOrders: clientsAdded.reduce((sum, c) => sum + c.orders.length, 0),
      completedOrders: clientsAdded.reduce(
        (sum, c) => sum + c.orders.filter((o) => o.status === "COMPLETED").length,
        0
      ),
      pendingOrders: clientsAdded.reduce(
        (sum, c) => sum + c.orders.filter((o) => o.status === "PENDING").length,
        0
      ),
      totalRevenue: clientsAdded.reduce((sum, client) => {
        const clientRevenue = client.orders
          .filter((o) => o.status === "COMPLETED")
          .reduce((clientSum, order) => {
            const subtotal = order.items.reduce((s, item) => s + 150 * item.quantity, 0);
            const discount = order.discounts.reduce((s, od) => s + od.discountAmount, 0);
            return clientSum + (subtotal - discount);
          }, 0);
        return sum + clientRevenue;
      }, 0),
      avgOrdersPerClient: clientsAdded.length > 0 
        ? (clientsAdded.reduce((sum, c) => sum + c.orders.length, 0) / clientsAdded.length).toFixed(1)
        : "0",
      avgRevenuePerClient: clientsAdded.length > 0
        ? (clientsAdded.reduce((sum, client) => {
            const clientRevenue = client.orders
              .filter((o) => o.status === "COMPLETED")
              .reduce((clientSum, order) => {
                const subtotal = order.items.reduce((s, item) => s + 150 * item.quantity, 0);
                const discount = order.discounts.reduce((s, od) => s + od.discountAmount, 0);
                return clientSum + (subtotal - discount);
              }, 0);
            return sum + clientRevenue;
          }, 0) / clientsAdded.length).toFixed(2)
        : "0",
    };

    // Get top performing clients
    const topClients = clientsAdded
      .map((client) => {
        const totalRevenue = client.orders
          .filter((o) => o.status === "COMPLETED")
          .reduce((sum, order) => {
            const subtotal = order.items.reduce((s, item) => s + 150 * item.quantity, 0);
            const discount = order.discounts.reduce((s, od) => s + od.discountAmount, 0);
            return sum + (subtotal - discount);
          }, 0);

        return {
          id: client.id,
          name: `${client.firstName} ${client.lastName}`,
          email: client.email,
          orderCount: client.orders.length,
          totalRevenue,
          hasInstall: !!client.freeInstallGivenBy,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);

    return NextResponse.json({
      stats,
      topClients,
    });
  } catch (error) {
    console.error("Failed to fetch salesmen stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
