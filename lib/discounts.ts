/**
 * Discount and Coupon Management
 * Handles validation, application, and tracking of discount codes
 */

import { prisma } from '@/lib/prisma';
import { getEffectivePrice, getInventoryPriceServiceType } from '@/lib/pricing';

export interface CouponValidationResult {
  valid: boolean;
  error?: string;
  coupon?: {
    id: string;
    code: string;
    type: string;
    value: number;
    isCredit?: boolean;
    remainingValue?: number;
    discountAmount?: number;
  };
}

export interface OrderPriceSummary {
  subtotal: number;
  discountAmount: number;
  total: number;
  appliedCoupons: string[];
}

async function calculateOrderSubtotal(order: {
  type: string;
  realtorId: string;
  realtor: { brokerageId: string | null } | null;
  items: Array<{ quantity: number }>;
  addons: Array<{ quantity: number; priceAtOrder: number; inventoryItemId: string }>;
}): Promise<number> {
  let subtotal = 0;

  for (const item of order.items) {
    const serviceType = order.type || 'INSTALL';

    try {
      const priceInCents = await getEffectivePrice(
        serviceType,
        order.realtorId,
        order.realtor?.brokerageId || undefined
      );
      subtotal += (priceInCents / 100) * item.quantity;
    } catch (error) {
      console.warn(`Using fallback price for service type ${serviceType}:`, error);
      subtotal += 150 * item.quantity;
    }
  }

  for (const addon of order.addons) {
    if (addon.priceAtOrder > 0) {
      subtotal += (addon.priceAtOrder / 100) * addon.quantity;
      continue;
    }

    try {
      const serviceType = getInventoryPriceServiceType(addon.inventoryItemId);
      const addonPriceInCents = await getEffectivePrice(
        serviceType,
        order.realtorId,
        order.realtor?.brokerageId || undefined
      );
      subtotal += (addonPriceInCents / 100) * addon.quantity;
    } catch (error) {
      console.warn(`Unable to resolve addon pricing for ${addon.inventoryItemId}:`, error);
    }
  }

  return subtotal;
}

/**
 * Validate and apply a coupon code to an order
 */
export async function validateAndApplyCoupon(
  couponCode: string,
  orderSubtotal: number
): Promise<CouponValidationResult> {
  try {
    // Get coupon
    const coupon = await prisma.coupon.findUnique({
      where: { code: couponCode.toUpperCase() },
    });

    if (!coupon) {
      return {
        valid: false,
        error: 'Coupon code not found',
      };
    }

    // Check if active
    if (!coupon.isActive) {
      return {
        valid: false,
        error: 'This coupon is no longer active',
      };
    }

    // Check expiration
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return {
        valid: false,
        error: 'This coupon has expired',
      };
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (coupon.isCredit) {
      const remainingValue = typeof coupon.remainingValue === 'number' && coupon.remainingValue > 0
        ? coupon.remainingValue
        : coupon.value;

      if (remainingValue <= 0) {
        return {
          valid: false,
          error: 'This credit has been fully used',
        };
      }

      discountAmount = Math.min(remainingValue, orderSubtotal);
    } else if (coupon.type === 'FIXED') {
      // Check usage limit for standard coupons only.
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        return {
          valid: false,
          error: 'This coupon has reached its usage limit',
        };
      }

      discountAmount = Math.min(coupon.value, orderSubtotal); // Don't exceed order total
    } else if (coupon.type === 'PERCENTAGE') {
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        return {
          valid: false,
          error: 'This coupon has reached its usage limit',
        };
      }

      discountAmount = (orderSubtotal * coupon.value) / 100;
    }

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        isCredit: coupon.isCredit,
        remainingValue: coupon.remainingValue ?? undefined,
        discountAmount,
      },
    };
  } catch (error) {
    console.error('Error validating coupon:', error);
    return {
      valid: false,
      error: 'An error occurred validating the coupon',
    };
  }
}

/**
 * Apply a validated coupon to an order
 */
export async function applyCouponToOrder(orderId: string, couponId: string, discountAmount: number) {
  try {
    const orderDiscount = await prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.findUnique({
        where: { id: couponId },
      });

      if (!coupon) {
        throw new Error('Coupon not found');
      }

      // Check if already applied
      const existing = await tx.orderDiscount.findUnique({
        where: {
          orderId_couponId: {
            orderId,
            couponId,
          },
        },
      });

      if (existing) {
        throw new Error('This coupon has already been applied to this order');
      }

      const orderDiscountRow = await tx.orderDiscount.create({
        data: {
          orderId,
          couponId,
          discountAmount,
        },
        include: {
          coupon: true,
        },
      });

      const couponUpdateData: any = {
        usedCount: { increment: 1 },
      };

      if (coupon.isCredit) {
        const currentRemaining = typeof coupon.remainingValue === 'number' && coupon.remainingValue > 0
          ? coupon.remainingValue
          : coupon.value;
        const nextRemaining = Math.max(0, currentRemaining - discountAmount);

        couponUpdateData.remainingValue = nextRemaining;
        couponUpdateData.isActive = nextRemaining > 0;
      }

      await tx.coupon.update({
        where: { id: couponId },
        data: couponUpdateData,
      });

      return orderDiscountRow;
    });

    console.log(`✅ Coupon applied to order ${orderId}: -$${discountAmount.toFixed(2)}`);
    return orderDiscount;
  } catch (error) {
    console.error('Error applying coupon:', error);
    throw error;
  }
}

/**
 * Remove a coupon from an order
 */
export async function removeCouponFromOrder(orderId: string, couponId: string) {
  try {
    const orderDiscount = await prisma.orderDiscount.delete({
      where: {
        orderId_couponId: {
          orderId,
          couponId,
        },
      },
      include: { coupon: true },
    });

    // Decrement coupon usage
    await prisma.coupon.update({
      where: { id: couponId },
      data: { usedCount: { decrement: 1 } },
    });

    console.log(`✅ Coupon removed from order ${orderId}`);
    return orderDiscount;
  } catch (error) {
    console.error('Error removing coupon:', error);
    throw error;
  }
}

/**
 * Get all active coupons
 */
export async function getActiveCoupons() {
  return await prisma.coupon.findMany({
    where: {
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: new Date() } },
      ],
    },
    select: {
      id: true,
      code: true,
      type: true,
      value: true,
      description: true,
      expiresAt: true,
      maxUses: true,
      usedCount: true,
    },
  });
}

/**
 * Create a new coupon
 */
export async function createCoupon(data: {
  code: string;
  type: 'FIXED' | 'PERCENTAGE';
  value: number;
  remainingValue?: number;
  isCredit?: boolean;
  description?: string;
  maxUses?: number;
  expiresAt?: Date;
}) {
  try {
    const coupon = await prisma.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        type: data.type,
        value: data.value,
        remainingValue: data.remainingValue ?? 0,
        isCredit: data.isCredit ?? false,
        description: data.description,
        maxUses: data.maxUses,
        expiresAt: data.expiresAt,
      },
    });

    console.log(`✅ Coupon created: ${coupon.code}`);
    return coupon;
  } catch (error) {
    console.error('Error creating coupon:', error);
    throw error;
  }
}

/**
 * Get price summary for an order with all discounts
 */
export async function getOrderPriceSummary(orderId: string): Promise<OrderPriceSummary> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        realtor: {
          select: {
            brokerageId: true,
          },
        },
        items: {
          include: { sign: true },
        },
        addons: {
          select: {
            inventoryItemId: true,
            quantity: true,
            priceAtOrder: true,
          },
        },
        discounts: {
          include: { coupon: true },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const subtotal = await calculateOrderSubtotal(order);

    // Calculate total discount
    const discountAmount = order.discounts.reduce((sum, od) => {
      return sum + od.discountAmount;
    }, 0);

    const total = Math.max(0, subtotal - discountAmount);

    return {
      subtotal,
      discountAmount,
      total,
      appliedCoupons: order.discounts.map((od) => od.coupon.code),
    };
  } catch (error) {
    console.error('Error calculating order price:', error);
    throw error;
  }
}

/**
 * Get coupon statistics
 */
export async function getCouponStats() {
  const [total, active, expired] = await Promise.all([
    prisma.coupon.count(),
    prisma.coupon.count({
      where: {
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
    }),
    prisma.coupon.count({
      where: {
        expiresAt: { lt: new Date() },
      },
    }),
  ]);

  const usageStats = await prisma.coupon.aggregate({
    _sum: { usedCount: true },
    _avg: { usedCount: true },
  });

  return {
    total,
    active,
    expired,
    totalUsed: usageStats._sum.usedCount || 0,
    avgUsesPerCoupon: (usageStats._avg.usedCount || 0).toFixed(2),
  };
}
