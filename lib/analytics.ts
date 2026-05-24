/**
 * Analytics and Reporting Utilities
 * Provides data for admin dashboard and analytics
 */

import { prisma } from '@/lib/prisma';

export interface DashboardStats {
  orders: {
    total: number;
    pending: number;
    completed: number;
    cancelled: number;
    completionRate: string;
  };
  revenue: {
    today: number;
    thisMonth: number;
    thisYear: number;
    average: number;
  };
  discounts: {
    totalDiscounted: number;
    averageDiscountPerOrder: number;
    activeCoupons: number;
  };
  sms: {
    sentToday: number;
    successRate: string;
  };
}

/**
 * Get comprehensive dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  // Order stats
  const [totalOrders, pendingOrders, completedOrders, cancelledOrders] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.count({ where: { status: 'COMPLETED' } }),
    prisma.order.count({ where: { status: 'CANCELLED' } }),
  ]);

  const completionRate =
    totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : '0';

  // Revenue calculations (from order items)
  const getRevenueByDateRange = async (startDate: Date) => {
    const orders = await prisma.order.findMany({
      where: {
        status: 'COMPLETED',
        updatedAt: { gte: startDate },
      },
      include: {
        items: { include: { sign: true } },
        discounts: true,
      },
    });

    let total = 0;
    orders.forEach((order) => {
      // Calculate based on quantity and default price (pricing system to be implemented)
      const subtotal = order.items.reduce((sum, item) => sum + (150 * item.quantity), 0);
      const discount = order.discounts.reduce((sum, od) => sum + od.discountAmount, 0);
      total += subtotal - discount;
    });

    return total;
  };

  const [revenueToday, revenueMonth, revenueYear] = await Promise.all([
    getRevenueByDateRange(todayStart),
    getRevenueByDateRange(monthStart),
    getRevenueByDateRange(yearStart),
  ]);

  const averageRevenue = totalOrders > 0 ? revenueYear / totalOrders : 0;

  // Discount stats
  const discountStats = await prisma.orderDiscount.aggregate({
    _sum: { discountAmount: true },
    _count: true,
  });

  const totalDiscounted = discountStats._sum.discountAmount || 0;
  const avgDiscountPerOrder = totalOrders > 0 ? totalDiscounted / totalOrders : 0;

  // Active coupons
  const activeCoupons = await prisma.coupon.count({
    where: {
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    },
  });

  // SMS stats
  const [smsSentToday, smsTotal, smsSent] = await Promise.all([
    prisma.sMSLog.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.sMSLog.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.sMSLog.count({ where: { createdAt: { gte: todayStart }, status: 'SENT' } }),
  ]);

  const smsSuccessRate = smsTotal > 0 ? ((smsSent / smsTotal) * 100).toFixed(1) : '0';

  return {
    orders: {
      total: totalOrders,
      pending: pendingOrders,
      completed: completedOrders,
      cancelled: cancelledOrders,
      completionRate: `${completionRate}%`,
    },
    revenue: {
      today: revenueToday,
      thisMonth: revenueMonth,
      thisYear: revenueYear,
      average: averageRevenue,
    },
    discounts: {
      totalDiscounted,
      averageDiscountPerOrder: avgDiscountPerOrder,
      activeCoupons,
    },
    sms: {
      sentToday: smsSentToday,
      successRate: `${smsSuccessRate}%`,
    },
  };
}

/**
 * Get order analytics by period
 */
export async function getOrderAnalytics(startDate: Date, endDate: Date) {
  const orders = await prisma.order.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      realtor: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      items: { include: { sign: true } },
      discounts: true,
    },
  });

  // Calculate metrics
  let totalRevenue = 0;
  let totalDiscount = 0;
  const statusBreakdown: Record<string, number> = {
    PENDING: 0,
    CONFIRMED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };

  orders.forEach((order) => {
    const subtotal = order.items.reduce((sum, item) => sum + (150 * item.quantity), 0);
    const discount = order.discounts.reduce((sum, od) => sum + od.discountAmount, 0);
    totalRevenue += subtotal - discount;
    totalDiscount += discount;
    statusBreakdown[order.status] = (statusBreakdown[order.status] || 0) + 1;
  });

  return {
    period: { startDate, endDate },
    orderCount: orders.length,
    totalRevenue,
    totalDiscount,
    averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
    statusBreakdown,
    orders: orders.map((o) => ({
      orderNumber: o.orderNumber,
      realtor: `${o.realtor.firstName} ${o.realtor.lastName}`,
      status: o.status,
      itemCount: o.items.length,
      revenue: o.items.reduce((sum, i) => sum + (150 * i.quantity), 0),
      discount: o.discounts.reduce((sum, od) => sum + od.discountAmount, 0),
    })),
  };
}

/**
 * Get realtor performance metrics
 */
export async function getRealtorPerformance() {
  const realtors = await prisma.user.findMany({
    where: { role: "REALTOR" },
    include: {
      orders: {
        include: {
          items: { include: { sign: true } },
          discounts: true,
        },
      },
    },
  });

  return realtors
    .map((realtor) => {
      let totalRevenue = 0;
      let completedCount = 0;

      realtor.orders.forEach((order) => {
        const subtotal = order.items.reduce((sum, item) => sum + (150 * item.quantity), 0);
        const discount = order.discounts.reduce((sum, od) => sum + od.discountAmount, 0);
        totalRevenue += subtotal - discount;

        if (order.status === 'COMPLETED') completedCount++;
      });

      const completionRate =
        realtor.orders.length > 0 ? ((completedCount / realtor.orders.length) * 100).toFixed(1) : '0';

      return {
        name: `${realtor.firstName} ${realtor.lastName}`,
        email: realtor.email,
        totalOrders: realtor.orders.length,
        completedOrders: completedCount,
        completionRate: `${completionRate}%`,
        totalRevenue,
        averageOrderValue: realtor.orders.length > 0 ? totalRevenue / realtor.orders.length : 0,
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

/**
 * Get SMS campaign statistics
 */
export async function getSMSCampaignStats() {
  const stats = await prisma.sMSLog.groupBy({
    by: ['eventType'],
    _count: { id: true },
    where: {
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    },
  });

  const detailed = await Promise.all(
    stats.map(async (stat) => {
      const sent = await prisma.sMSLog.count({
        where: {
          eventType: stat.eventType,
          status: 'SENT',
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      });

      const failed = await prisma.sMSLog.count({
        where: {
          eventType: stat.eventType,
          status: 'FAILED',
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      });

      return {
        eventType: stat.eventType,
        total: stat._count.id,
        sent,
        failed,
        successRate: ((sent / stat._count.id) * 100).toFixed(1) + '%',
      };
    })
  );

  return detailed;
}

/**
 * Get top performing signs by revenue
 */
export async function getTopSigns(limit: number = 10) {
  const signs = await prisma.sign.findMany({
    include: {
      orderItems: {
        include: {
          order: { include: { discounts: true, items: true } },
        },
      },
    },
  });

  const signStats = signs.map((sign) => {
    let totalRevenue = 0;
    let totalQuantity = 0;
    let orderCount = new Set<string>();

    sign.orderItems.forEach((item) => {
      totalQuantity += item.quantity;
      orderCount.add(item.order.id);
      const subtotal = 150 * item.quantity; // Default price per sign
      const discount = item.order.discounts.reduce((sum, od) => sum + od.discountAmount / item.order.items.length, 0);
      totalRevenue += subtotal - discount;
    });

    return {
      signName: sign.signNumber || `Sign ${sign.id}`,
      signType: sign.type,
      status: sign.status,
      totalSold: totalQuantity,
      orderCount: orderCount.size,
      totalRevenue,
      averageRevenuePerOrder: orderCount.size > 0 ? totalRevenue / orderCount.size : 0,
    };
  });

  return signStats.sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, limit);
}
