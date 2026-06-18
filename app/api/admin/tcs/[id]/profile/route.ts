import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateTCProfileSchema = z.object({
  email: z.string().trim().email(),
  phone: z.string().trim().optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tc = await prisma.user.findFirst({
      where: {
        id: params.id,
        role: "TC",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        tags: true,
        createdAt: true,
        tcAgentLinks: {
          select: {
            id: true,
            agentUserId: true,
            grantedBy: true,
            createdAt: true,
            agentUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!tc) {
      return NextResponse.json({ error: "TC not found" }, { status: 404 });
    }

    const orders = await prisma.order.findMany({
      where: {
        placedByTCId: tc.id,
      },
      select: {
        id: true,
        orderNumber: true,
        type: true,
        status: true,
        address: true,
        addressLat: true,
        addressLng: true,
        createdAt: true,
        scheduledDate: true,
        realtor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json({
      tc: {
        id: tc.id,
        firstName: tc.firstName,
        lastName: tc.lastName,
        email: tc.email,
        phone: tc.phone,
        isActive: !tc.tags.includes("INACTIVE"),
        createdAt: tc.createdAt,
      },
      linkedAgents: tc.tcAgentLinks.map((link) => ({
        linkId: link.id,
        grantedBy: link.grantedBy,
        linkedAt: link.createdAt,
        agent: link.agentUser,
      })),
      orders,
      stats: {
        linkedAgentCount: tc.tcAgentLinks.length,
        totalOrders: orders.length,
        mappedOrders: orders.filter(
          (o) => o.addressLat !== null && o.addressLng !== null
        ).length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch TC profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch TC profile" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    const role = (session?.user as any)?.role;
    if (!session?.user?.id || (role !== "ADMIN" && role !== "SALESMEN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateTCProfileSchema.parse(body);
    const normalizedEmail = parsed.email.toLowerCase();

    const tc = await prisma.user.findFirst({
      where: {
        id: params.id,
        role: "TC",
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (!tc) {
      return NextResponse.json({ error: "TC not found" }, { status: 404 });
    }

    const emailInUse = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        NOT: { id: tc.id },
      },
      select: { id: true },
    });

    if (emailInUse) {
      return NextResponse.json(
        { error: "Another user already has this email" },
        { status: 409 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: tc.id },
      data: {
        email: normalizedEmail,
        phone: parsed.phone && parsed.phone.length > 0 ? parsed.phone : null,
      },
      select: {
        id: true,
        email: true,
        phone: true,
      },
    });

    return NextResponse.json({
      success: true,
      tc: updated,
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Failed to update TC profile:", error);
    return NextResponse.json(
      { error: "Failed to update TC profile" },
      { status: 500 }
    );
  }
}
