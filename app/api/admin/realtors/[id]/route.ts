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

    const realtor = await prisma.user.findUnique({
      where: { id: params.id, role: "REALTOR" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        paymentMethod: true,
        brokerageId: true,
        brokerage: {
          select: {
            name: true,
            id: true,
          },
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            type: true,
            status: true,
            address: true,
            scheduledDate: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!realtor) {
      return NextResponse.json(
        { error: "Realtor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ realtor });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
