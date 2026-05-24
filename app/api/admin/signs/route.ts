import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/signs - List all signs with filters and search
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const search = url.searchParams.get("search");
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");

  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (type) {
    where.type = type;
  }

  if (search) {
    where.OR = [
      { signNumber: { contains: search, mode: "insensitive" } },
      { deployedAddress: { contains: search, mode: "insensitive" } },
    ];
  }

  try {
    const [signs, total] = await Promise.all([
      prisma.sign.findMany({
        where,
        include: {
          assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignedToOrder: { select: { id: true, orderNumber: true } },
          reports: { where: { resolvedAt: null }, select: { id: true, type: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { signNumber: "asc" },
      }),
      prisma.sign.count({ where }),
    ]);

    return Response.json({
      signs,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error fetching signs:", err);
    return Response.json({ error: "Failed to fetch signs" }, { status: 500 });
  }
}

// POST /api/admin/signs - Create a new sign
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { signNumber, type, deployedAddress, deployedLat, deployedLng, notes } = body;

    if (!signNumber || !type) {
      return Response.json({ error: "signNumber and type are required" }, { status: 400 });
    }

    const sign = await prisma.sign.create({
      data: {
        signNumber,
        type,
        status: "AVAILABLE",
        deployedAddress: deployedAddress || null,
        deployedLat: deployedLat || null,
        deployedLng: deployedLng || null,
        notes: notes || null,
      },
    });

    return Response.json(sign, { status: 201 });
  } catch (err: any) {
    console.error("Error creating sign:", err);
    if (err.code === "P2002" && err.meta?.target?.includes("signNumber")) {
      return Response.json({ error: "Sign number already exists" }, { status: 400 });
    }
    return Response.json({ error: "Failed to create sign" }, { status: 500 });
  }
}
