import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { objectsToCSV, formatDateForFilename } from '@/lib/reports';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    // Parse dates
    const startDate = startDateStr ? new Date(startDateStr) : (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d;
    })();
    const endDate = endDateStr ? new Date(endDateStr) : new Date();

    // Fetch all field techs
    const fieldTechs = await prisma.user.findMany({
      where: {
        role: 'TC',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch assignments for each TC in the date range
    const tcStats: Record<string, any> = {};

    for (const tc of fieldTechs) {
      const assignments = await prisma.jobAssignment.count({
        where: {
          fieldTechId: tc.id,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      const completedAssignments = await prisma.jobAssignment.count({
        where: {
          fieldTechId: tc.id,
          completedAt: {
            not: null,
            gte: startDate,
            lte: endDate,
          },
        },
      });

      tcStats[tc.id] = {
        name: `${tc.firstName} ${tc.lastName}`,
        email: tc.email,
        phone: tc.phone || 'N/A',
        totalAssignments: assignments,
        completedAssignments: completedAssignments,
        completionRate: assignments > 0 ? `${((completedAssignments / assignments) * 100).toFixed(1)}%` : 'N/A',
        joined: new Date(tc.createdAt).toLocaleDateString(),
      };
    }

    // Format for CSV
    const csvData = Object.values(tcStats);

    return generateCSVResponse(csvData, 'field-techs');
  } catch (error) {
    console.error('Field Techs report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate field techs report' },
      { status: 500 }
    );
  }
}

function generateCSVResponse(data: any[], reportName: string) {
  const csv = objectsToCSV(data);
  const filename = `${reportName}-report-${formatDateForFilename(new Date())}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
