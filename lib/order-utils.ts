import { prisma } from "@/lib/prisma";

export async function generateOrderNumber(): Promise<string> {
  // Find the MAXIMUM order number in the database (not just the last created)
  const allOrders = await prisma.order.findMany({
    select: { orderNumber: true },
    orderBy: { orderNumber: "desc" },
    take: 1,
  });

  let nextNumber = 1;
  
  if (allOrders.length > 0) {
    const lastOrderNumber = allOrders[0].orderNumber;
    if (lastOrderNumber.startsWith("SPF-")) {
      const currentNumber = parseInt(lastOrderNumber.replace("SPF-", ""));
      nextNumber = currentNumber + 1;
    }
  }

  // Try up to 10 sequential numbers to find one that's not taken
  // (handles potential collisions from concurrent requests)
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidateNumber = `SPF-${String(nextNumber + attempt).padStart(5, "0")}`;
    
    const existing = await prisma.order.findUnique({
      where: { orderNumber: candidateNumber },
      select: { id: true },
    });
    
    if (!existing) {
      return candidateNumber;
    }
    
    console.warn(`⚠️ Order number collision detected: ${candidateNumber}, trying next...`);
  }

  throw new Error("Unable to generate unique order number after 10 attempts");
}
