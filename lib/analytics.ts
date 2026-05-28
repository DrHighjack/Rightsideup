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

/**
 * Phase 5 — Comprehensive Dashboard Analytics
 */

export interface DashboardMetrics {
  revenueToday: number;
  revenueLastMonth: number;
  revenueThisMonth: number;
  revenueGrowthPercent: number;
  ordersThisWeekByType: Record<string, number>;
  completionRate: number;
  outstandingInvoiceTotal: number;
  activeRealtorsThisMonth: number;
  signsDeployedRatio: string;
  avgJobCompletionTimeHours: number;
}

export interface RevenueData {
  date: string;
  revenue: number;
}

export interface OrdersData {
  week: string;
  INSTALL: number;
  REMOVAL: number;
  CHANGE: number;
}

export interface StatusData {
  name: string;
  value: number;
}

export interface RealtorMetrics {
  id: string;
  name: string;
  email: string;
  orderCount: number;
  totalRevenue: number;
  lastOrderDate: string | null;
}

export interface TechMetrics {
  id: string;
  name: string;
  email: string;
  jobsCompleted: number;
  avgCompletionTimeHours: number;
  openIssuesCount: number;
}

/**
 * Get dashboard metrics for the date range
 */
export async function getDashboardMetrics(
  startDate: Date,
  endDate: Date
): Promise<DashboardMetrics> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Helper to calculate revenue
  const getRevenue = async (start: Date, end: Date) => {
    const orders = await prisma.order.findMany({
      where: {
        status: 'COMPLETED',
        updatedAt: { gte: start, lte: end },
      },
      include: {
        items: true,
        discounts: true,
      },
    });

    return orders.reduce((total, order) => {
      const subtotal = order.items.reduce((sum, item) => sum + 150 * item.quantity, 0);
      const discount = order.discounts.reduce((sum, od) => sum + od.discountAmount, 0);
      return total + (subtotal - discount);
    }, 0);
  };

  // Revenue metrics
  const revenueToday = await getRevenue(todayStart, now);
  const revenueThisMonth = await getRevenue(thisMonthStart, now);
  const revenueLastMonth = await getRevenue(lastMonthStart, lastMonthEnd);
  const revenueGrowthPercent =
    revenueLastMonth > 0 ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100 : 0;

  // Orders this week by type
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekOrders = await prisma.order.findMany({
    where: {
      createdAt: { gte: weekStart, lte: now },
    },
  });

  const ordersThisWeekByType: Record<string, number> = {
    INSTALL: 0,
    REMOVAL: 0,
    CHANGE: 0,
  };

  weekOrders.forEach((order) => {
    const type = (order.type || 'INSTALL').toUpperCase() as keyof typeof ordersThisWeekByType;
    if (type in ordersThisWeekByType) {
      ordersThisWeekByType[type]++;
    }
  });

  // Completion rate
  const [totalOrders, completedOrders] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
    prisma.order.count({
      where: { status: 'COMPLETED', createdAt: { gte: startDate, lte: endDate } },
    }),
  ]);

  const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

  // Outstanding invoices
  const outstandingInvoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['PENDING', 'SENT', 'PARTIALLY_PAID'] },
    },
  });

  const outstandingInvoiceTotal = outstandingInvoices.reduce(
    (sum, inv) => sum + (inv.amount || 0),
    0
  );

  // Active realtors this month
  const activeRealtorsThisMonth = (
    await prisma.user.findMany({
      where: {
        role: 'REALTOR',
        orders: {
          some: {
            createdAt: { gte: thisMonthStart },
          },
        },
      },
      select: { id: true },
    })
  ).length;

  // Signs deployed vs available ratio
  const [deployedSigns, totalSigns] = await Promise.all([
    prisma.sign.count({ where: { status: { in: ['DEPLOYED', 'IN_USE'] } } }),
    prisma.sign.count(),
  ]);

  const signsDeployedRatio =
    totalSigns > 0 ? `${((deployedSigns / totalSigns) * 100).toFixed(1)}%` : '0%';

  // Average job completion time
  const completedJobs = await prisma.jobAssignment.findMany({
    where: {
      completedAt: { not: null },
    },
  });

  let avgCompletionTimeHours = 0;
  if (completedJobs.length > 0) {
    const totalHours = completedJobs.reduce((sum, job) => {
      if (job.completedAt && job.createdAt) {
        const hours = (job.completedAt.getTime() - job.createdAt.getTime()) / (1000 * 60 * 60);
        return sum + hours;
      }
      return sum;
    }, 0);
    avgCompletionTimeHours = totalHours / completedJobs.length;
  }

  return {
    revenueToday,
    revenueLastMonth,
    revenueThisMonth,
    revenueGrowthPercent: parseFloat(revenueGrowthPercent.toFixed(2)),
    ordersThisWeekByType,
    completionRate: parseFloat(completionRate.toFixed(2)),
    outstandingInvoiceTotal,
    activeRealtorsThisMonth,
    signsDeployedRatio,
    avgJobCompletionTimeHours: parseFloat(avgCompletionTimeHours.toFixed(2)),
  };
}

/**
 * Get daily revenue data for the date range
 */
export async function getRevenueData(startDate: Date, endDate: Date): Promise<RevenueData[]> {
  const orders = await prisma.order.findMany({
    where: {
      status: 'COMPLETED',
      updatedAt: { gte: startDate, lte: endDate },
    },
    include: {
      items: true,
      discounts: true,
    },
  });

  const revenueByDay: Record<string, number> = {};

  orders.forEach((order) => {
    const day = order.updatedAt.toISOString().split('T')[0];
    const subtotal = order.items.reduce((sum, item) => sum + 150 * item.quantity, 0);
    const discount = order.discounts.reduce((sum, od) => sum + od.discountAmount, 0);
    const revenue = subtotal - discount;

    revenueByDay[day] = (revenueByDay[day] || 0) + revenue;
  });

  // Fill in missing days
  const data: RevenueData[] = [];
  for (
    let d = new Date(startDate);
    d <= endDate;
    d.setDate(d.getDate() + 1)
  ) {
    const day = d.toISOString().split('T')[0];
    data.push({
      date: day,
      revenue: revenueByDay[day] || 0,
    });
  }

  return data;
}

/**
 * Get weekly orders grouped by type
 */
export async function getOrdersData(startDate: Date, endDate: Date): Promise<OrdersData[]> {
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  const ordersByWeek: Record<string, Record<string, number>> = {};

  orders.forEach((order) => {
    const date = new Date(order.createdAt);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const week = weekStart.toISOString().split('T')[0];

    const type = (order.type || 'INSTALL').toUpperCase() as string;

    if (!ordersByWeek[week]) {
      ordersByWeek[week] = { INSTALL: 0, REMOVAL: 0, CHANGE: 0 };
    }

    if (type in ordersByWeek[week]) {
      ordersByWeek[week][type]++;
    }
  });

  return Object.entries(ordersByWeek)
    .map(([week, data]) => ({
      week,
      INSTALL: data.INSTALL || 0,
      REMOVAL: data.REMOVAL || 0,
      CHANGE: data.CHANGE || 0,
    }))
    .sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime());
}

/**
 * Get current order status distribution
 */
export async function getStatusData(): Promise<StatusData[]> {
  const statuses = ['PENDING', 'SCHEDULED', 'ON_HOLD', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

  const counts = await Promise.all(
    statuses.map((status) =>
      prisma.order.count({ where: { status } })
    )
  );

  return statuses
    .map((status, idx) => ({
      name: status,
      value: counts[idx],
    }))
    .filter((s) => s.value > 0);
}

/**
 * Get top 10 realtors by order count and revenue
 */
export async function getRealtorsMetrics(): Promise<RealtorMetrics[]> {
  const realtors = await prisma.user.findMany({
    where: { role: 'REALTOR' },
    include: {
      orders: {
        include: { items: true, discounts: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const metrics = realtors
    .map((realtor) => {
      const totalRevenue = realtor.orders.reduce((sum, order) => {
        const subtotal = order.items.reduce((s, item) => s + 150 * item.quantity, 0);
        const discount = order.discounts.reduce((s, od) => s + od.discountAmount, 0);
        return sum + (subtotal - discount);
      }, 0);

      return {
        id: realtor.id,
        name: `${realtor.firstName} ${realtor.lastName}`,
        email: realtor.email,
        orderCount: realtor.orders.length,
        totalRevenue,
        lastOrderDate: realtor.orders[0]?.createdAt.toISOString().split('T')[0] || null,
      };
    })
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 10);

  return metrics;
}

/**
 * Get field tech performance metrics
 */
export async function getTechMetrics(): Promise<TechMetrics[]> {
  const techs = await prisma.user.findMany({
    where: { role: 'FIELD_TECH' },
    include: {
      jobAssignments: true,
    },
  });

  const metrics = await Promise.all(
    techs.map(async (tech) => {
      const completedJobs = tech.jobAssignments.filter((j) => j.completedAt !== null);

      // Calculate average completion time
      let avgCompletionTimeHours = 0;
      if (completedJobs.length > 0) {
        const totalHours = completedJobs.reduce((sum, job) => {
          if (job.completedAt) {
            const hours =
              (job.completedAt.getTime() - job.createdAt.getTime()) / (1000 * 60 * 60);
            return sum + hours;
          }
          return sum;
        }, 0);
        avgCompletionTimeHours = totalHours / completedJobs.length;
      }

      // Count open/pending issues (jobs without completedAt)
      const openIssuesCount = tech.jobAssignments.filter((j) => j.completedAt === null).length;

      return {
        id: tech.id,
        name: `${tech.firstName} ${tech.lastName}`,
        email: tech.email,
        jobsCompleted: completedJobs.length,
        avgCompletionTimeHours: parseFloat(avgCompletionTimeHours.toFixed(2)),
        openIssuesCount,
      };
    })
  );

  return metrics.sort((a, b) => b.jobsCompleted - a.jobsCompleted);
}
