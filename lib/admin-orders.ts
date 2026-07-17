import { prisma } from "@/lib/prisma";

export interface AdminOrdersQuery {
  status?: string | null;
  type?: string | null;
  realtorId?: string | null;
  search?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number;
  limit?: number;
}

export async function getAdminOrders({
  status,
  type,
  realtorId,
  search,
  dateFrom,
  dateTo,
  page = 1,
  limit = 20,
}: AdminOrdersQuery) {
  const where: any = {};

  if (status) where.status = status;
  if (type) where.type = type;
  if (realtorId) where.realtorId = realtorId;

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      where.createdAt.gte = new Date(dateFrom);
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = endDate;
    }
  }

  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { address: { contains: search, mode: "insensitive" } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        realtor: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}
