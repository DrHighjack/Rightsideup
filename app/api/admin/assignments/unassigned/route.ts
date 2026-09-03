import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Cleared orders are ready for installer assignment even before a date is set.
    const unassignedOrders = await prisma.order.findMany({
      where: {
        status: { in: ['READY_TO_SCHEDULE', 'SCHEDULED'] },
        jobAssignment: null,
      },
      include: {
        realtor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { scheduledDate: 'asc' },
    });

    return NextResponse.json(unassignedOrders);
  } catch (error: any) {
    console.error('[UNASSIGNED ORDERS] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
