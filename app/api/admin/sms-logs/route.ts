/**
 * GET /api/admin/sms-logs - Get SMS logs with filtering
 */

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await auth();

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const eventType = url.searchParams.get('eventType');
    const days = url.searchParams.get('days') || '7';
    const page = url.searchParams.get('page') || '1';
    const limit = url.searchParams.get('limit') || '50';

    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const where: any = {
      createdAt: { gte: startDate },
    };

    if (status) where.status = status;
    if (eventType) where.eventType = eventType;

    const [logs, total] = await Promise.all([
      prisma.sMSLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.sMSLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching SMS logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SMS logs' },
      { status: 500 }
    );
  }
}
