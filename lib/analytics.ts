/**
 * Analytics and Reporting Utilities
 * Provides data for admin dashboard and analytics
 */

import { prisma } from '@/lib/prisma';
import { getEffectivePrice } from '@/lib/pricing';
import { getOrSet } from '@/lib/cache';

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
    prisma.order.count({ where: { status: { in: ['IN_GROUND', 'COMPLETED'] } } }),
    prisma.order.count({ where: { status: 'CANCELLED' } }),
  ]);

  const completionRate =
    totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : '0';

  // Revenue calculations (from order items and pricing system)
  const getRevenueByDateRange = async (startDate: Date) => {
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['IN_GROUND', 'COMPLETED'] },
        updatedAt: { gte: startDate },
      },
      include: {
        realtor: true,
        items: { include: { sign: true } },
        discounts: true,
      },
    });

    let total = 0;
    for (const order of orders) {
      // Calculate price for each item based on pricing system
      let subtotal = 0;
      for (const item of order.items) {
        // Use service type from order (default to INSTALL if not set)
        const serviceType = order.type || 'INSTALL';
        // Get effective price for this realtor and their brokerage
        const priceInCents = await getEffectivePrice(serviceType, order.realtorId, order.realtor?.brokerageId || undefined);
        subtotal += priceInCents * item.quantity;
      }
      const discount = order.discounts.reduce((sum, od) => sum + od.discountAmount, 0);
      total += subtotal - discount;
    }

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
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          brokerageId: true,
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

  const ordersWithRevenue = [];

  for (const order of orders) {
    let subtotal = 0;
    for (const item of order.items) {
      const serviceType = order.type || 'INSTALL';
      const priceInCents = await getEffectivePrice(serviceType, order.realtor.id, order.realtor.brokerageId || undefined);
      subtotal += priceInCents * item.quantity;
    }
    const discount = order.discounts.reduce((sum, od) => sum + od.discountAmount, 0);
    totalRevenue += subtotal - discount;
    totalDiscount += discount;
    statusBreakdown[order.status] = (statusBreakdown[order.status] || 0) + 1;

    ordersWithRevenue.push({
      orderNumber: order.orderNumber,
      realtor: `${order.realtor.firstName} ${order.realtor.lastName}`,
      status: order.status,
      itemCount: order.items.length,
      revenue: subtotal,
      discount: discount,
    });
  }

  return {
    period: { startDate, endDate },
    orderCount: orders.length,
    totalRevenue,
    totalDiscount,
    averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
    statusBreakdown,
    orders: ordersWithRevenue,
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

  const realtorMetrics = [];

  for (const realtor of realtors) {
    let totalRevenue = 0;
    let completedCount = 0;

    for (const order of realtor.orders) {
      let subtotal = 0;
      for (const item of order.items) {
        const serviceType = order.type || 'INSTALL';
        const priceInCents = await getEffectivePrice(serviceType, realtor.id, realtor.brokerageId || undefined);
        subtotal += priceInCents * item.quantity;
      }
      const discount = order.discounts.reduce((sum, od) => sum + od.discountAmount, 0);
      totalRevenue += subtotal - discount;

      if (order.status === 'COMPLETED' || order.status === 'IN_GROUND') completedCount++;
    }

    const completionRate =
      realtor.orders.length > 0 ? ((completedCount / realtor.orders.length) * 100).toFixed(1) : '0';

    realtorMetrics.push({
      name: `${realtor.firstName} ${realtor.lastName}`,
      email: realtor.email,
      totalOrders: realtor.orders.length,
      completedOrders: completedCount,
      completionRate: `${completionRate}%`,
      totalRevenue,
      averageOrderValue: realtor.orders.length > 0 ? totalRevenue / realtor.orders.length : 0,
    });
  }

  return realtorMetrics.sort((a, b) => b.totalRevenue - a.totalRevenue);
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
          order: { include: { realtor: true, discounts: true, items: true } },
        },
      },
    },
  });

  const signStats = [];

  for (const sign of signs) {
    let totalRevenue = 0;
    let totalQuantity = 0;
    const orderCount = new Set<string>();

    for (const item of sign.orderItems) {
      totalQuantity += item.quantity;
      orderCount.add(item.order.id);
      
      const serviceType = item.order.type || 'INSTALL';
      const priceInCents = await getEffectivePrice(serviceType, item.order.realtor.id, item.order.realtor.brokerageId || undefined);
      const subtotal = priceInCents * item.quantity;
      const discount = item.order.discounts.reduce((sum, od) => sum + od.discountAmount / item.order.items.length, 0);
      totalRevenue += subtotal - discount;
    }

    signStats.push({
      signName: sign.signNumber || `Sign ${sign.id}`,
      signType: sign.type,
      status: sign.status,
      totalSold: totalQuantity,
      orderCount: orderCount.size,
      totalRevenue,
      averageRevenuePerOrder: orderCount.size > 0 ? totalRevenue / orderCount.size : 0,
    });
  }

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
  // Use Redis cache to avoid recalculating on every request
  const cacheKey = `dashboard-metrics:${startDate.getTime()}:${endDate.getTime()}`;
  
  return getOrSet(
    cacheKey,
    async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Revenue metrics - use Invoice amounts (faster than dynamic pricing)
      const getRevenueOptimized = async (start: Date, end: Date) => {
        // Use aggregation on invoices which have pre-calculated amounts
        const invoiceResult = await prisma.invoice.aggregate({
          where: {
            createdAt: { gte: start, lte: end },
            status: { in: ['SENT', 'VIEWED', 'PAID', 'OVERDUE'] },
          },
          _sum: { amount: true },
        });

        return invoiceResult._sum.amount || 0;
      };

      const [revenueToday, revenueThisMonth, revenueLastMonth] = await Promise.all([
        getRevenueOptimized(todayStart, now),
        getRevenueOptimized(thisMonthStart, now),
        getRevenueOptimized(lastMonthStart, lastMonthEnd),
      ]);

      const revenueGrowthPercent =
        revenueLastMonth > 0 ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100 : 0;

      // Orders this week by type - use aggregation
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      
      const weekOrderStats = await prisma.order.groupBy({
        by: ['type'],
        where: {
          createdAt: { gte: weekStart, lte: now },
        },
        _count: true,
      });

      const ordersThisWeekByType: Record<string, number> = {
        INSTALL: 0,
        REMOVAL: 0,
        CHANGE: 0,
      };

      weekOrderStats.forEach((stat) => {
        const type = (stat.type || 'INSTALL').toUpperCase() as keyof typeof ordersThisWeekByType;
        if (type in ordersThisWeekByType) {
          ordersThisWeekByType[type] = stat._count;
        }
      });

      // Completion rate - use count instead of fetching all
      const [totalOrders, completedOrders] = await Promise.all([
        prisma.order.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
        prisma.order.count({
          where: { status: { in: ['IN_GROUND', 'COMPLETED'] }, createdAt: { gte: startDate, lte: endDate } },
        }),
      ]);

      const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

      // Outstanding invoices - use aggregation instead of fetching all
      const outstandingInvoiceAgg = await prisma.invoice.aggregate({
        where: {
          status: { in: ['SENT', 'VIEWED', 'OVERDUE'] },
        },
        _sum: { amount: true },
      });

      const outstandingInvoiceTotal = outstandingInvoiceAgg._sum.amount || 0;

      // Active realtors this month - use _count
      const activeRealtorsThisMonth = await prisma.user.count({
        where: {
          role: 'REALTOR',
          orders: {
            some: {
              createdAt: { gte: thisMonthStart },
            },
          },
        },
      });

      // Signs deployed vs available ratio
      const [deployedSigns, totalSigns] = await Promise.all([
        prisma.sign.count({ where: { status: 'DEPLOYED' } }),
        prisma.sign.count(),
      ]);

      const signsDeployedRatio =
        totalSigns > 0 ? `${((deployedSigns / totalSigns) * 100).toFixed(1)}%` : '0%';

      // Average job completion time - fetch completed jobs and calculate
      const completedJobs = await prisma.jobAssignment.findMany({
        where: {
          completedAt: { not: null },
        },
        select: { createdAt: true, completedAt: true },
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
    },
    { ttl: 60 } // Cache for 60 seconds
  );
}

/**
 * Get daily revenue data for the date range - OPTIMIZED with caching
 */
export async function getRevenueData(startDate: Date, endDate: Date): Promise<RevenueData[]> {
  const cacheKey = `revenue-data:${startDate.getTime()}:${endDate.getTime()}`;
  
  return getOrSet(
    cacheKey,
    async () => {
      // Get invoices grouped by date
      const invoices = await prisma.invoice.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: { in: ['SENT', 'VIEWED', 'PAID', 'OVERDUE'] },
        },
        select: { createdAt: true, amount: true },
      });

      const revenueByDay: Record<string, number> = {};

      // Map revenue to days
      for (const invoice of invoices) {
        const day = invoice.createdAt.toISOString().split('T')[0];
        revenueByDay[day] = (revenueByDay[day] || 0) + (invoice.amount || 0);
      }

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
    },
    { ttl: 60 }
  );
}

/**
 * Get weekly orders grouped by type - OPTIMIZED
 */
export async function getOrdersData(startDate: Date, endDate: Date): Promise<OrdersData[]> {
  const cacheKey = `orders-data:${startDate.getTime()}:${endDate.getTime()}`;
  
  return getOrSet(
    cacheKey,
    async () => {
      // Use groupBy aggregation instead of fetching all orders
      const ordersByType = await prisma.order.groupBy({
        by: ['createdAt', 'type'],
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
        _count: true,
      });

      const ordersByWeek: Record<string, Record<string, number>> = {};

      // Process aggregated data
      for (const stat of ordersByType) {
        const date = new Date(stat.createdAt);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const week = weekStart.toISOString().split('T')[0];

        const type = (stat.type || 'INSTALL').toUpperCase() as string;

        if (!ordersByWeek[week]) {
          ordersByWeek[week] = { INSTALL: 0, REMOVAL: 0, CHANGE: 0 };
        }

        if (type in ordersByWeek[week]) {
          ordersByWeek[week][type] += stat._count;
        }
      }

      return Object.entries(ordersByWeek)
        .map(([week, data]) => ({
          week,
          INSTALL: data.INSTALL || 0,
          REMOVAL: data.REMOVAL || 0,
          CHANGE: data.CHANGE || 0,
        }))
        .sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime());
    },
    { ttl: 60 }
  );
}

/**
 * Get current order status distribution - OPTIMIZED
 */
export async function getStatusData(): Promise<StatusData[]> {
  const cacheKey = 'status-data';
  
  return getOrSet(
    cacheKey,
    async () => {
      const statuses = ['PENDING', 'SCHEDULED', 'ON_HOLD', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

      const counts = await Promise.all(
        statuses.map((status) =>
          prisma.order.count({ where: { status: status as any } })
        )
      );

      return statuses
        .map((status, idx) => ({
          name: status,
          value: counts[idx],
        }))
        .filter((s) => s.value > 0);
    },
    { ttl: 60 }
  );
}

/**
 * Get top 10 realtors by order count and revenue
 */
export async function getRealtorsMetrics(): Promise<RealtorMetrics[]> {
  // Use invoices for revenue instead of per-order pricing to avoid N+1 queries
  const realtors = await prisma.user.findMany({
    where: { role: 'REALTOR' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      brokerageId: true,
      orders: {
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: { select: { orders: true } },
    },
  });

  // Aggregate paid invoice totals per user in one query
  const invoiceTotals = await prisma.invoice.groupBy({
    by: ['userId'],
    where: { status: { in: ['PAID'] } },
    _sum: { amount: true },
  });
  const invoiceTotalMap = new Map(
    invoiceTotals.map((row) => [row.userId, row._sum.amount || 0])
  );

  const metrics = realtors.map((realtor) => ({
    id: realtor.id,
    name: `${realtor.firstName} ${realtor.lastName}`,
    email: realtor.email,
    orderCount: realtor._count.orders,
    totalRevenue: invoiceTotalMap.get(realtor.id) || 0,
    lastOrderDate: realtor.orders[0]?.createdAt.toISOString().split('T')[0] || null,
  }));

  return metrics
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 10);
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
