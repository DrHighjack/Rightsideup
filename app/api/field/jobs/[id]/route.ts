import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/mobile-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getRequestUser(request);

    if (!user?.id || user.role !== 'FIELD_TECH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const fieldTechId = user.id;
    const { id } = params;

    // Get assignment - verify it belongs to this field tech
    const assignment = await prisma.jobAssignment.findUnique({
      where: { id },
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

    if (!assignment) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Verify this assignment belongs to the current field tech
    if (assignment.fieldTechId !== fieldTechId) {
      return NextResponse.json(
        { error: 'Forbidden - not assigned to you' },
        { status: 403 }
      );
    }

    return NextResponse.json(assignment);
  } catch (error: any) {
    console.error('[FIELD JOB DETAIL GET] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
