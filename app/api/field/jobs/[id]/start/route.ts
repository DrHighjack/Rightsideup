import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function PUT(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== 'FIELD_TECH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const fieldTechId = session.user.id;
    const { id } = params;

    // Get assignment - verify it belongs to this field tech
    const assignment = await prisma.jobAssignment.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (assignment.fieldTechId !== fieldTechId) {
      return NextResponse.json(
        { error: 'Forbidden - not assigned to you' },
        { status: 403 }
      );
    }

    // Cannot start if already started or completed
    if (assignment.startedAt) {
      return NextResponse.json(
        { error: 'Job already started' },
        { status: 400 }
      );
    }

    // Update assignment and order status
    const updatedAssignment = await prisma.jobAssignment.update({
      where: { id },
      data: {
        startedAt: new Date(),
      },
      include: {
        order: {
          include: {
            realtor: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
            assignedSigns: {
              select: {
                id: true,
                signNumber: true,
                type: true,
                status: true,
              },
            },
          },
        },
      },
    });

    // Update order status to IN_PROGRESS
    await prisma.order.update({
      where: { id: assignment.orderId },
      data: { status: 'IN_PROGRESS' },
    });

    return NextResponse.json(updatedAssignment);
  } catch (error: any) {
    console.error('[FIELD JOB START] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
