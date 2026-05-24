import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { z } from 'zod';

const updateAssignmentSchema = z.object({
  fieldTechId: z.string().min(1).optional(),
  scheduledFor: z.string().datetime().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;
    const body = await request.json();
    const { fieldTechId, scheduledFor } = updateAssignmentSchema.parse(body);

    // Get current assignment
    const assignment = await prisma.jobAssignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // If reassigning to different tech, validate new tech
    if (fieldTechId && fieldTechId !== assignment.fieldTechId) {
      const newFieldTech = await prisma.user.findUnique({
        where: { id: fieldTechId },
      });

      if (!newFieldTech || newFieldTech.role !== 'FIELD_TECH') {
        return NextResponse.json(
          { error: 'Invalid FIELD_TECH user' },
          { status: 400 }
        );
      }
    }

    // Update assignment
    const updateData: any = {};
    if (fieldTechId) updateData.fieldTechId = fieldTechId;
    if (scheduledFor) updateData.scheduledFor = new Date(scheduledFor);

    const updatedAssignment = await prisma.jobAssignment.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(updatedAssignment);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[ADMIN ASSIGNMENTS PUT] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = params;

    // Check if assignment exists
    const assignment = await prisma.jobAssignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Delete assignment
    await prisma.jobAssignment.delete({
      where: { id },
    });

    return NextResponse.json(
      { success: true, message: 'Assignment deleted' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[ADMIN ASSIGNMENTS DELETE] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
