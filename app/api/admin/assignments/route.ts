import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
import { createNotification } from '@/lib/notifications';
import { ActivityAction } from '@prisma/client';

const assignmentSchema = z.object({
  orderId: z.string().min(1),
  fieldTechId: z.string().min(1),
  scheduledFor: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const fieldTechId = searchParams.get('fieldTechId');
    const date = searchParams.get('date');
    const status = searchParams.get('status'); // 'active', 'completed', 'all'

    // Build where clause
    const where: any = {};

    if (fieldTechId) {
      where.fieldTechId = fieldTechId;
    }

    if (date) {
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);

      where.scheduledFor = {
        gte: dateStart,
        lte: dateEnd,
      };
    }

    if (status === 'active') {
      where.completedAt = null;
    } else if (status === 'completed') {
      where.completedAt = { not: null };
    }

    // Get assignments with related data
    const assignments = await prisma.jobAssignment.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            address: true,
            status: true,
          },
        },
        fieldTech: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { scheduledFor: 'asc' },
    });

    return NextResponse.json(assignments);
  } catch (error: any) {
    console.error('[ADMIN ASSIGNMENTS GET] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { orderId, fieldTechId, scheduledFor } = assignmentSchema.parse(body);

    // Validate order exists and is assignable
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.status !== 'SCHEDULED' && order.status !== 'ON_HOLD') {
      return NextResponse.json(
        {
          error: `Order must be SCHEDULED or ON_HOLD. Current status: ${order.status}`,
        },
        { status: 400 }
      );
    }

    // Check if already assigned
    const existingAssignment = await prisma.jobAssignment.findUnique({
      where: { orderId },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'Order is already assigned to a job' },
        { status: 400 }
      );
    }

    // Validate field tech exists and has FIELD_TECH role
    const fieldTech = await prisma.user.findUnique({
      where: { id: fieldTechId },
    });

    if (!fieldTech) {
      return NextResponse.json(
        { error: 'Field tech user not found' },
        { status: 404 }
      );
    }

    if (fieldTech.role !== 'FIELD_TECH') {
      return NextResponse.json(
        { error: 'User is not a FIELD_TECH' },
        { status: 400 }
      );
    }

    // Create assignment
    const assignment = await prisma.jobAssignment.create({
      data: {
        orderId,
        fieldTechId,
        assignedByUserId: session.user.id,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            address: true,
            status: true,
          },
        },
        fieldTech: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: ActivityAction.JOB_ASSIGNED,
      entityType: 'JobAssignment',
      entityId: assignment.id,
      description: `Job assigned to ${fieldTech.firstName} ${fieldTech.lastName} for order ${order.orderNumber}`,
      metadata: {
        orderId,
        orderNumber: order.orderNumber,
        fieldTechId,
        fieldTechEmail: fieldTech.email,
        scheduledFor,
      },
    });

    // Notify the field tech about the new job assignment
    await createNotification({
      userId: fieldTechId,
      type: 'JOB_ASSIGNED',
      title: `New job assigned: ${order.orderNumber}`,
      message: `You have been assigned a new job at ${order.address}${
        scheduledFor ? ` scheduled for ${new Date(scheduledFor).toLocaleDateString()}` : ''
      }`,
      link: `/dashboard/jobs/${assignment.id}`,
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[ADMIN ASSIGNMENTS POST] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
