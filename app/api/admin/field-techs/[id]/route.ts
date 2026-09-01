import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const updateFieldTechSchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { isActive } = updateFieldTechSchema.parse(await request.json());
    const fieldTech = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        role: true,
        tags: true,
        jobAssignments: {
          where: { completedAt: null },
          select: { id: true },
        },
      },
    });

    if (!fieldTech || fieldTech.role !== 'FIELD_TECH') {
      return NextResponse.json({ error: 'Installer account not found' }, { status: 404 });
    }

    if (!isActive && fieldTech.jobAssignments.length > 0) {
      return NextResponse.json(
        { error: 'Reassign or complete this installer’s open jobs before removing access.' },
        { status: 409 }
      );
    }

    const tagsWithoutInactive = fieldTech.tags.filter((tag) => tag !== 'INACTIVE');
    const updated = await prisma.user.update({
      where: { id: fieldTech.id },
      data: {
        tags: {
          set: isActive ? tagsWithoutInactive : [...tagsWithoutInactive, 'INACTIVE'],
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        tags: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      fieldTech: {
        ...updated,
        isActive: !updated.tags.includes('INACTIVE'),
        tags: undefined,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }

    console.error('[ADMIN FIELD-TECHS] Update error:', error);
    return NextResponse.json({ error: 'Failed to update installer account' }, { status: 500 });
  }
}