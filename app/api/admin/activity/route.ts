import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getActivityLogs } from '@/lib/activityLog';
import { ActivityAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/activity
 * Paginated activity logs with optional filtering
 * Query params:
 * - page: number (default 1)
 * - pageSize: number (default 50, max 100)
 * - userId: string (filter by user)
 * - action: ActivityAction enum (filter by action)
 * - entityType: string (filter by entity type)
 * - startDate: ISO date string (filter start)
 * - endDate: ISO date string (filter end)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Parse pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));

    // Parse filters
    const filters: any = {};
    
    if (searchParams.has('userId')) {
      filters.userId = searchParams.get('userId');
    }
    
    if (searchParams.has('action')) {
      const action = searchParams.get('action');
      if (Object.values(ActivityAction).includes(action as ActivityAction)) {
        filters.action = action;
      }
    }
    
    if (searchParams.has('entityType')) {
      filters.entityType = searchParams.get('entityType');
    }

    if (searchParams.has('startDate')) {
      const startDate = new Date(searchParams.get('startDate')!);
      if (!isNaN(startDate.getTime())) {
        filters.startDate = startDate;
      }
    }

    if (searchParams.has('endDate')) {
      const endDate = new Date(searchParams.get('endDate')!);
      if (!isNaN(endDate.getTime())) {
        filters.endDate = endDate;
      }
    }

    // Get activity logs
    const result = await getActivityLogs(page, pageSize, filters);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Activity log error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity logs' },
      { status: 500 }
    );
  }
}
