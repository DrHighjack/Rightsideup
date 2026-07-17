import { prisma } from "@/lib/prisma";
import { getAdminOrders } from "@/lib/admin-orders";
import OrdersListClient from "./OrdersListClient";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const [{ orders, pagination }, fieldTechs] = await Promise.all([
    getAdminOrders({ page: 1, limit: 20 }),
    prisma.user.findMany({
      where: { role: "FIELD_TECH" },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: "asc" },
    }),
  ]);

  const serialized = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    address: o.address,
    type: o.type,
    status: o.status as string,
    scheduledDate: o.scheduledDate?.toISOString(),
    createdAt: o.createdAt.toISOString(),
    isStale: o.isStale,
    realtor: {
      id: o.realtor.id,
      firstName: o.realtor.firstName,
      lastName: o.realtor.lastName,
    },
  }));

  return (
    <OrdersListClient
      initialOrders={serialized}
      initialTotalPages={pagination.pages}
      initialFieldTechs={fieldTechs}
    />
  );
}
