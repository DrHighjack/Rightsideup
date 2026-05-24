import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all FIELD_TECH users
    const fieldTechs = await prisma.user.findMany({
      where: { role: 'FIELD_TECH' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
        assignedJobs: {
          where: { completedAt: null }, // Count only non-completed assignments
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add job count to each tech
    const fieldTechsWithCounts = fieldTechs.map((tech) => ({
      ...tech,
      assignedJobCount: tech.assignedJobs.length,
      assignedJobs: undefined, // Remove the array, keep only count
    }));

    return NextResponse.json(fieldTechsWithCounts);
  } catch (error: any) {
    console.error('[ADMIN FIELD-TECHS] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
