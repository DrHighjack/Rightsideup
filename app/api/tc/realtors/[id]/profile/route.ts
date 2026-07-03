import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PENDING_INVOICE_STATUSES = new Set(["DRAFT", "SENT", "VIEWED", "OVERDUE"]);

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tcUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    });

    if (!tcUser || tcUser.role !== "TC") {
      return NextResponse.json({ error: "Only TCs can access this route" }, { status: 403 });
    }

    const realtorId = params.id;
    if (!realtorId) {
      return NextResponse.json({ error: "Realtor id is required" }, { status: 400 });
    }

    const link = await prisma.tCAgentLink.findUnique({
      where: {
        tcUserId_agentUserId: {
          tcUserId: tcUser.id,
          agentUserId: realtorId,
        },
      },
      select: { id: true },
    });

    if (!link) {
      return NextResponse.json({ error: "Realtor is not linked to this TC" }, { status: 403 });
    }

    const [realtor, orders, invoices] = await Promise.all([
      prisma.user.findUnique({
        where: { id: realtorId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          brokerageName: true,
        },
      }),
      prisma.order.findMany({
        where: { realtorId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          address: true,
          addressLat: true,
          addressLng: true,
          type: true,
          status: true,
          scheduledDate: true,
          createdAt: true,
        },
        take: 300,
      }),
      prisma.invoice.findMany({
        where: { userId: realtorId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          discountAmount: true,
          paidAmount: true,
          status: true,
          dueDate: true,
          createdAt: true,
        },
        take: 300,
      }),
    ]);

    if (!realtor) {
      return NextResponse.json({ error: "Realtor not found" }, { status: 404 });
    }

    const pendingInvoices = invoices.filter((invoice) => PENDING_INVOICE_STATUSES.has(invoice.status));
    const pastInvoices = invoices.filter((invoice) => !PENDING_INVOICE_STATUSES.has(invoice.status));

    return NextResponse.json({
      realtor,
      mapPosts: orders.filter(
        (order) => typeof order.addressLat === "number" && typeof order.addressLng === "number"
      ),
      recentOrders: orders.slice(0, 15),
      pendingInvoices,
      pastInvoices,
      totals: {
        totalOrders: orders.length,
        mappedPosts: orders.filter(
          (order) => typeof order.addressLat === "number" && typeof order.addressLng === "number"
        ).length,
        pendingInvoices: pendingInvoices.length,
        pastInvoices: pastInvoices.length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch TC realtor profile:", error);
    return NextResponse.json({ error: "Failed to fetch realtor profile" }, { status: 500 });
  }
}
