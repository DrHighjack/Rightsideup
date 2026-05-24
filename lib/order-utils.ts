import { prisma } from "@/lib/prisma";

export async function generateOrderNumber(): Promise<string> {
  const lastOrder = await prisma.order.findFirst({
    orderBy: { createdAt: "desc" },
    select: { orderNumber: true },
  });

  let nextNumber = 1;
  if (lastOrder && lastOrder.orderNumber.startsWith("SPF-")) {
    const currentNumber = parseInt(lastOrder.orderNumber.replace("SPF-", ""));
    nextNumber = currentNumber + 1;
  }

  return `SPF-${String(nextNumber).padStart(5, "0")}`;
}
