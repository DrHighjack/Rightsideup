/**
 * GET /api/admin/analytics/dashboard - Main dashboard stats
 * GET /api/admin/analytics/realtors - Realtor performance
 * GET /api/admin/analytics/sms - SMS campaign stats
 * GET /api/admin/analytics/signs - Top performing signs
 */

import { auth } from '@/lib/auth';
import {
  getDashboardStats,
  getRealtorPerformance,
  getSMSCampaignStats,
  getTopSigns,
  getOrderAnalytics,
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
    const section = url.searchParams.get('section');

    switch (section) {
      case 'dashboard':
        return dashboardHandler();
      case 'realtors':
        return realtorHandler();
      case 'sms':
        return smsHandler();
      case 'signs':
        return signsHandler();
      case 'orders':
        return orderHandler(req);
      default:
        return dashboardHandler();
    }
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

async function dashboardHandler() {
  const stats = await getDashboardStats();
  return NextResponse.json(stats);
}

async function realtorHandler() {
  const performance = await getRealtorPerformance();
  return NextResponse.json({ realtors: performance });
}

async function smsHandler() {
  const stats = await getSMSCampaignStats();
  return NextResponse.json({ campaigns: stats });
}

async function signsHandler() {
  const topSigns = await getTopSigns(15);
  return NextResponse.json({ topSigns });
}

async function orderHandler(req: Request) {
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
