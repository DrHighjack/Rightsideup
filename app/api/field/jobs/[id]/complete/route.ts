import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { z } from 'zod';

const completeJobSchema = z.object({
  techNotes: z.string().min(1),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== 'FIELD_TECH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const fieldTechId = session.user.id;
    const { id } = params;
    const body = await request.json();
    const { techNotes } = completeJobSchema.parse(body);

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

    // Cannot complete if not started
    if (!assignment.startedAt) {
      return NextResponse.json(
        { error: 'Job must be started first' },
        { status: 400 }
      );
    }

    // Cannot complete if already completed
    if (assignment.completedAt) {
      return NextResponse.json(
        { error: 'Job already completed' },
        { status: 400 }
      );
    }

    // Update assignment with completion info
    const updatedAssignment = await prisma.jobAssignment.update({
      where: { id },
      data: {
        completedAt: new Date(),
        techNotes,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
      },
    });

    // Update order status to COMPLETED
    await prisma.order.update({
      where: { id: assignment.orderId },
      data: { status: 'COMPLETED' },
    });

    return NextResponse.json(updatedAssignment);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[FIELD JOB COMPLETE] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
