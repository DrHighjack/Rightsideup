import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { objectsToCSV, formatDateForFilename } from '@/lib/reports';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all realtor clients
    const realtors = await prisma.user.findMany({
      where: {
        role: 'REALTOR',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        brokerageName: true,
        createdAt: true,
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format for CSV
    const csvData = realtors.map((realtor) => ({
      'Name': `${realtor.firstName} ${realtor.lastName}`,
      'Email': realtor.email,
      'Phone': realtor.phone || 'N/A',
      'Company': realtor.brokerageName || 'N/A',
      'Total Orders': realtor._count.orders,
      'Joined': new Date(realtor.createdAt).toLocaleDateString(),
    }));

    return generateCSVResponse(csvData, 'clients');
  } catch (error) {
    console.error('Clients report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate clients report' },
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
