import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/salesmen/clients
 * List all realtor clients (for salesmen to manage)
 * Salesmen can only see clients, not invoices or activity
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

    const clients = await prisma.user.findMany({
      where: {
        role: "REALTOR",
        ...searchFilter,
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
