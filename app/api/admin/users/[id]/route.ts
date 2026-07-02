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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        paymentMethod: true,
        brokerageName: true,
        freeInstallGivenBy: true,
        freeInstallDate: true,
        tags: true,
        adminNotes: true,
        createdAt: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const orders = await prisma.order.findMany({
      where: { realtorId: params.id },
      select: {
        id: true,
        orderNumber: true,
        type: true,
        status: true,
        address: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      user,
      orders,
      orderCount: orders.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
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

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      paymentMethod,
      brokerageName,
      closedByUserId,
      tags,
      adminNotes,
      isActive,
    } = body;

    const hasUpdatableField =
      firstName !== undefined ||
      lastName !== undefined ||
      email !== undefined ||
      phone !== undefined ||
      paymentMethod !== undefined ||
      brokerageName !== undefined ||
      closedByUserId !== undefined ||
      tags !== undefined ||
      adminNotes !== undefined ||
      isActive !== undefined;

    if (!hasUpdatableField) {
      return NextResponse.json(
        { error: "No fields provided to update" },
        { status: 400 }
      );
    }

    // If either name is provided, ensure both are valid non-empty strings.
    if (firstName !== undefined || lastName !== undefined) {
      if (!firstName?.trim() || !lastName?.trim()) {
        return NextResponse.json(
          { error: "First name and last name are required" },
          { status: 400 }
        );
      }
    }

    if (
      paymentMethod !== undefined &&
      paymentMethod !== "OFFICE" &&
      paymentMethod !== "SELF"
    ) {
      return NextResponse.json(
        { error: "Payment method must be OFFICE or SELF" },
        { status: 400 }
      );
    }

    // Validate email if provided
    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }

      // Check if email is already taken by another user
      const existingUser = await prisma.user.findUnique({
        where: { email: email.trim() },
      });

      if (existingUser && existingUser.id !== params.id) {
        return NextResponse.json(
          { error: "Email is already in use" },
          { status: 400 }
        );
      }
    }

    const shouldUpdateCloser = closedByUserId !== undefined;
    const normalizedCloserId =
      typeof closedByUserId === "string" ? closedByUserId.trim() : "";

    if (shouldUpdateCloser && normalizedCloserId) {
      const closer = await prisma.user.findUnique({
        where: { id: normalizedCloserId },
        select: { id: true, role: true },
      });

      if (!closer || !["ADMIN", "SALESMEN"].includes(closer.role)) {
        return NextResponse.json(
          { error: "Closed By user must be an Admin or Salesman" },
          { status: 400 }
        );
      }
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, tags: true },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let nextTags: string[] | undefined;
    if (Array.isArray(tags) || typeof isActive === "boolean") {
      const baseTags = Array.isArray(tags)
        ? tags
            .map((tag: string) => (typeof tag === "string" ? tag.trim() : ""))
            .filter(Boolean)
        : existingUser.tags;

      const uniqueTags = Array.from(new Set(baseTags));
      const tagsWithoutInactive = uniqueTags.filter((tag) => tag !== "INACTIVE");

      if (typeof isActive === "boolean") {
        nextTags = isActive
          ? tagsWithoutInactive
          : [...tagsWithoutInactive, "INACTIVE"];
      } else {
        nextTags = uniqueTags;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(firstName !== undefined ? { firstName: firstName.trim() } : {}),
        ...(lastName !== undefined ? { lastName: lastName.trim() } : {}),
        ...(email !== undefined ? { email: email?.trim() || undefined } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        paymentMethod: paymentMethod ?? undefined,
        ...(brokerageName !== undefined
          ? { brokerageName: brokerageName?.trim() || null }
          : {}),
        freeInstallGivenBy: shouldUpdateCloser
          ? normalizedCloserId || null
          : undefined,
        freeInstallDate: shouldUpdateCloser
          ? normalizedCloserId
            ? new Date()
            : null
          : undefined,
        ...(nextTags ? { tags: { set: nextTags } } : {}),
        ...(adminNotes !== undefined ? { adminNotes: adminNotes || null } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        paymentMethod: true,
        brokerageName: true,
        freeInstallGivenBy: true,
        freeInstallDate: true,
        tags: true,
        adminNotes: true,
        createdAt: true,
        role: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (session.user.id === params.id) {
      return NextResponse.json(
        { error: "You cannot permanently delete your own account" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        role: true,
        email: true,
        tags: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!["REALTOR", "TC", "FIELD_TECH"].includes(user.role)) {
      return NextResponse.json(
        { error: "Permanent delete is only allowed for deactivated test client accounts" },
        { status: 400 }
      );
    }

    if (!user.tags.includes("INACTIVE")) {
      return NextResponse.json(
        { error: "Account must be deactivated before permanent delete" },
        { status: 400 }
      );
    }

    const [orderCount, invoiceCount, tcLinkCount, assignedJobCount, ticketCount] =
      await Promise.all([
        prisma.order.count({ where: { realtorId: user.id } }),
        prisma.invoice.count({ where: { userId: user.id } }),
        prisma.tCAgentLink.count({
          where: {
            OR: [{ tcUserId: user.id }, { agentUserId: user.id }],
          },
        }),
        prisma.jobAssignment.count({
          where: {
            OR: [{ assignedByUserId: user.id }, { fieldTechId: user.id }],
          },
        }),
        prisma.ticket811.count({ where: { realtorId: user.id } }),
      ]);

    const hasBusinessData =
      orderCount > 0 ||
      invoiceCount > 0 ||
      tcLinkCount > 0 ||
      assignedJobCount > 0 ||
      ticketCount > 0;

    if (hasBusinessData) {
      return NextResponse.json(
        {
          error:
            "Cannot permanently delete this account because it has related business records. Keep it deactivated instead.",
          details: {
            orders: orderCount,
            invoices: invoiceCount,
            tcLinks: tcLinkCount,
            jobAssignments: assignedJobCount,
            tickets811: ticketCount,
          },
        },
        { status: 400 }
      );
    }

    await prisma.user.delete({ where: { id: user.id } });

    return NextResponse.json({
      success: true,
      message: `Deleted account ${user.email}`,
      deletedUserId: user.id,
    });
  } catch (error) {
    console.error("Failed to permanently delete user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
