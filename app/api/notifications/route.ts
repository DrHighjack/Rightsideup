import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAllNotifications, getUnreadCount } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 * Returns unread notifications for the logged-in user
 * Query params:
 * - limit: number (default 10, max 50)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));

    // Get notifications
    const notifications = await getAllNotifications(session.user.id, limit);
    const unreadCount = await getUnreadCount(session.user.id);

    return NextResponse.json({
      notifications,
      unreadCount,
      count: notifications.length,
    });
  } catch (error) {
    console.error('Notifications fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
