import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== 'FIELD_TECH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const fieldTechId = session.user.id;

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get date 7 days from now
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    sevenDaysLater.setHours(23, 59, 59, 999);

    // Get assignments for this field tech for today and next 7 days
    const assignments = await prisma.jobAssignment.findMany({
      where: {
        fieldTechId,
        scheduledFor: {
          gte: today,
          lte: sevenDaysLater,
        },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            address: true,
            status: true,
            notes: true,
            adminNotes: true,
          },
        },
      },
      orderBy: [
        { scheduledFor: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return NextResponse.json(assignments);
  } catch (error: any) {
    console.error('[FIELD JOBS GET] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
