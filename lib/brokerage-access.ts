import { prisma } from "@/lib/prisma";

export async function getAccessibleBrokerages(userId: string) {
  return prisma.brokerage.findMany({
    where: {
      isActive: true,
      OR: [
        { adminId: userId },
        { accessGrants: { some: { userId } } },
      ],
    },
    select: { id: true, name: true, address: true, billingType: true },
    orderBy: { name: "asc" },
  });
}

export async function resolveAccessibleBrokerageId(
  userId: string,
  requestedBrokerageId?: string | null
) {
  const brokerages = await getAccessibleBrokerages(userId);
  if (!brokerages.length) return null;
  if (!requestedBrokerageId) return brokerages[0].id;
  return brokerages.some((brokerage) => brokerage.id === requestedBrokerageId)
    ? requestedBrokerageId
    : null;
}

export async function canAccessBrokerages(userId: string, brokerageIds: string[]) {
  const uniqueIds = Array.from(new Set(brokerageIds));
  if (!uniqueIds.length) return false;
  const accessible = await getAccessibleBrokerages(userId);
  const accessibleIds = new Set(accessible.map((brokerage) => brokerage.id));
  return uniqueIds.every((brokerageId) => accessibleIds.has(brokerageId));
}