import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/salesmen/clients
 * List clients added by the current salesman
 * - SALESMEN: Only see clients they've added (freeInstallGivenBy = their ID)
 * - ADMIN: Can see all clients
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || !["ADMIN", "SALESMEN"].includes((session.user as any).role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;
    const userRole = (session.user as any).role;
    const userId = session.user.id;

    // Build search filter
    const searchFilter = search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { brokerageName: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    // For SALESMEN, only show clients they added; for ADMIN, show all
    const roleFilter = userRole === "SALESMEN" ? { freeInstallGivenBy: userId } : {};

    const clients = await prisma.user.findMany({
      where: {
        role: "REALTOR",
        ...searchFilter,
        ...roleFilter,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        brokerageName: true,
        paymentMethod: true,
        freeInstallGivenBy: true,
        freeInstallDate: true,
        createdAt: true,
        _count: {
          select: { orders: true },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    const total = await prisma.user.count({
      where: {
        role: "REALTOR",
        ...searchFilter,
        ...roleFilter,
      },
    });

    return NextResponse.json({
      clients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Failed to fetch clients:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
