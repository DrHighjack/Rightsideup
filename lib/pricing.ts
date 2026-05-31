import { prisma } from "@/lib/prisma";

/**
 * Get the effective price for a service, resolving overrides in this order:
 * 1. Realtor-level override (if userId provided)
 * 2. Brokerage-level override (if brokerageId provided)
 * 3. Master price
 * 
 * Returns price in cents (e.g., 4500 = $45.00)
 */
export async function getEffectivePrice(
  serviceType: string,
  userId?: string,
  brokerageId?: string
): Promise<number> {
  try {
    // Check for realtor-level override first
    if (userId) {
      const realtorOverride = await prisma.priceOverride.findUnique({
        where: {
          serviceType_userId: {
            serviceType,
            userId,
          },
        },
      });
      if (realtorOverride) {
        return realtorOverride.amountCents;
      }
    }

    // Check for brokerage-level override second
    if (brokerageId) {
      const brokerageOverride = await prisma.priceOverride.findUnique({
        where: {
          serviceType_brokerageId: {
            serviceType,
            brokerageId,
          },
        },
      });
      if (brokerageOverride) {
        return brokerageOverride.amountCents;
      }
    }

    // Fall back to master price
    const masterPrice = await prisma.masterPrice.findUnique({
      where: { serviceType },
    });

    if (!masterPrice) {
      throw new Error(`No price found for service type: ${serviceType}`);
    }

    return masterPrice.amountCents;
  } catch (error) {
    console.error("Error getting effective price:", error);
    throw error;
  }
}

/**
 * Update the master price for a service type and cascade to all unlocked overrides.
 * Locked overrides remain unchanged.
 */
export async function updateMasterPrice(
  serviceType: string,
  amountCents: number
): Promise<void> {
  try {
    // Update or create the master price
    await prisma.masterPrice.upsert({
      where: { serviceType },
      update: { amountCents, updatedAt: new Date() },
      create: { serviceType, amountCents },
    });

    // Cascade update to all unlocked overrides for this service type
    // This ensures that overrides that aren't explicitly locked stay in sync with the master
    await prisma.priceOverride.updateMany({
      where: {
        serviceType,
        isLocked: false,
      },
      data: {
        amountCents,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error updating master price:", error);
    throw error;
  }
}

/**
 * Lock a price override so it won't be updated when master price changes
 */
export async function lockPrice(
  serviceType: string,
  userId?: string,
  brokerageId?: string
): Promise<void> {
  try {
    if (userId && brokerageId) {
      throw new Error("Cannot lock both userId and brokerageId simultaneously");
    }

    if (!userId && !brokerageId) {
      throw new Error("Either userId or brokerageId must be provided");
    }

    if (userId) {
      await prisma.priceOverride.update({
        where: {
          serviceType_userId: {
            serviceType,
            userId,
          },
        },
        data: {
          isLocked: true,
          updatedAt: new Date(),
        },
      });
    } else if (brokerageId) {
      await prisma.priceOverride.update({
        where: {
          serviceType_brokerageId: {
            serviceType,
            brokerageId,
          },
        },
        data: {
          isLocked: true,
          updatedAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error("Error locking price:", error);
    throw error;
  }
}

/**
 * Unlock a price override so it will be updated when master price changes
 */
export async function unlockPrice(
  serviceType: string,
  userId?: string,
  brokerageId?: string
): Promise<void> {
  try {
    if (userId && brokerageId) {
      throw new Error("Cannot unlock both userId and brokerageId simultaneously");
    }

    if (!userId && !brokerageId) {
      throw new Error("Either userId or brokerageId must be provided");
    }

    if (userId) {
      await prisma.priceOverride.update({
        where: {
          serviceType_userId: {
            serviceType,
            userId,
          },
        },
        data: {
          isLocked: false,
          updatedAt: new Date(),
        },
      });
    } else if (brokerageId) {
      await prisma.priceOverride.update({
        where: {
          serviceType_brokerageId: {
            serviceType,
            brokerageId,
          },
        },
        data: {
          isLocked: false,
          updatedAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error("Error unlocking price:", error);
    throw error;
  }
}

/**
 * Create or update a price override for a service type at realtor or brokerage level
 */
export async function setPriceOverride(
  serviceType: string,
  amountCents: number,
  userId?: string,
  brokerageId?: string
): Promise<void> {
  try {
    if (userId && brokerageId) {
      throw new Error("Cannot set both userId and brokerageId simultaneously");
    }

    if (!userId && !brokerageId) {
      throw new Error("Either userId or brokerageId must be provided");
    }

    if (userId) {
      await prisma.priceOverride.upsert({
        where: {
          serviceType_userId: {
            serviceType,
            userId,
          },
        },
        update: {
          amountCents,
          updatedAt: new Date(),
        },
        create: {
          serviceType,
          amountCents,
          userId,
          isLocked: false,
        },
      });
    } else if (brokerageId) {
      await prisma.priceOverride.upsert({
        where: {
          serviceType_brokerageId: {
            serviceType,
            brokerageId,
          },
        },
        update: {
          amountCents,
          updatedAt: new Date(),
        },
        create: {
          serviceType,
          amountCents,
          brokerageId,
          isLocked: false,
        },
      });
    }
  } catch (error) {
    console.error("Error setting price override:", error);
    throw error;
  }
}
