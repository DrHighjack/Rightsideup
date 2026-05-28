/**
 * GET /api/admin/analytics - Comprehensive analytics with date range support
 * Query params:
 * - section: dashboard | revenue | orders | status | realtors | techs
 * - startDate: ISO date string (defaults to 30 days ago)
 * - endDate: ISO date string (defaults to today)
 */

import { auth } from '@/lib/auth';
import {
  getDashboardStats,
  getRealtorPerformance,
  getSMSCampaignStats,
  getTopSigns,
  getOrderAnalytics,
  getDashboardMetrics,
  getRevenueData,
  getOrdersData,
  getStatusData,
  getRealtorsMetrics,
  getTechMetrics,
} from '@/lib/analytics';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await auth();

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const section = url.searchParams.get('section') || 'dashboard';

    // Parse date range (defaults to last 30 days)
    let startDate = url.searchParams.get('startDate');
    let endDate = url.searchParams.get('endDate');

    let start = new Date();
    let end = new Date();

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      // Default: last 30 days
      start.setDate(start.getDate() - 30);
    }

    switch (section) {
      case 'dashboard':
        return dashboardHandler(start, end);
      case 'revenue':
        return revenueHandler(start, end);
      case 'orders':
        return ordersHandler(start, end);
      case 'status':
        return statusHandler();
      case 'realtors':
        return realtorsHandler();
      case 'techs':
        return techsHandler();
      case 'legacy-dashboard':
        return legacyDashboardHandler();
      case 'realtors-legacy':
        return legacyRealtorHandler();
      case 'sms':
        return smsCampaignHandler();
      case 'signs':
        return signsHandler();
      case 'orders-legacy':
        return orderHandlerLegacy(req);
      default:
        return dashboardHandler(start, end);
    }
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

// New Phase 5 handlers
async function dashboardHandler(startDate: Date, endDate: Date) {
  const metrics = await getDashboardMetrics(startDate, endDate);
  return NextResponse.json(metrics);
}

async function revenueHandler(startDate: Date, endDate: Date) {
  const data = await getRevenueData(startDate, endDate);
  return NextResponse.json({ data });
}

async function ordersHandler(startDate: Date, endDate: Date) {
  const data = await getOrdersData(startDate, endDate);
  return NextResponse.json({ data });
}

async function statusHandler() {
  const data = await getStatusData();
  return NextResponse.json({ data });
}

async function realtorsHandler() {
  const data = await getRealtorsMetrics();
  return NextResponse.json({ realtors: data });
}

async function techsHandler() {
  const data = await getTechMetrics();
  return NextResponse.json({ techs: data });
}

// Legacy handlers (for backwards compatibility)
async function legacyDashboardHandler() {
  const stats = await getDashboardStats();
  return NextResponse.json(stats);
}

async function legacyRealtorHandler() {
  const performance = await getRealtorPerformance();
  return NextResponse.json({ realtors: performance });
}

async function smsCampaignHandler() {
  const stats = await getSMSCampaignStats();
  return NextResponse.json({ campaigns: stats });
}

async function signsHandler() {
  const topSigns = await getTopSigns(15);
  return NextResponse.json({ topSigns });
}

async function orderHandlerLegacy(req: Request) {
  const url = new URL(req.url);
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'Missing required parameters: startDate, endDate' },
      { status: 400 }
    );
  }

  const analytics = await getOrderAnalytics(
    new Date(startDate),
    new Date(endDate)
  );

  return NextResponse.json(analytics);
}
