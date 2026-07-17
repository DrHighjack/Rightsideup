import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OrdersListClient from "./OrdersListClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function OrdersPage() {
  const session = await auth();
  const userId = session?.user?.id as string;
  const role = (session?.user as any)?.role as string | undefined;

  const where = role === "REALTOR" ? { realtorId: userId } : {};

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      take: PAGE_SIZE,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        address: true,
        type: true,
        status: true,
        scheduledDate: true,
        createdAt: true,
      },
    }),
    prisma.order.count({ where }),
  ]);

  const serialized = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    address: o.address,
    type: o.type,
    status: o.status as string,
    scheduledDate: o.scheduledDate?.toISOString(),
    createdAt: o.createdAt.toISOString(),
  }));

  return (
    <OrdersListClient
      initialOrders={serialized}
      initialTotalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
    />
  );
}
