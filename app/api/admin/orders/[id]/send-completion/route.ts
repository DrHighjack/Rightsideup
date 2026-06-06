import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, getPostInstalledEmail } from "@/lib/email";

/**
 * POST /api/admin/orders/[id]/send-completion
 * Send post-installation completion email with photo and review request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { installationImageUrl, reviewLink } = body;

    if (!installationImageUrl) {
      return NextResponse.json(
        { error: "installationImageUrl is required" },
        { status: 400 }
      );
    }

    // Get order details
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        realtor: {
          select: { id: true, firstName: true, email: true },
        },
      },
    });

    if (!order || !order.realtor) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Send completion email
    const emailData = getPostInstalledEmail(
      order.realtor.firstName,
      order.orderNumber,
      order.address,
      new Date(order.updatedAt || new Date()).toLocaleDateString(),
      installationImageUrl,
      `${process.env.NEXTAUTH_URL}/admin/orders/${order.id}`,
      reviewLink || `${process.env.NEXTAUTH_URL}/reviews/${order.id}`
    );

    await sendEmail({
      to: order.realtor.email,
      subject: emailData.subject,
      html: emailData.html,
    });

    return NextResponse.json({
      success: true,
      message: "Installation completion email sent successfully",
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        address: order.address,
      },
    });
  } catch (error) {
    console.error("Failed to send completion email:", error);
    return NextResponse.json(
      { error: "Failed to send completion email" },
      { status: 500 }
    );
  }
}
