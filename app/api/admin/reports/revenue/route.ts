import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { objectsToCSV, formatDateForFilename, formatCurrency } from '@/lib/reports';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const format = searchParams.get('format') || 'csv';

    // Parse dates
    const startDate = startDateStr ? new Date(startDateStr) : (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d;
    })();
    const endDate = endDateStr ? new Date(endDateStr) : new Date();

    // Fetch orders for revenue calculation
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: ['COMPLETED'],
        },
      },
      include: {
        realtor: {
          select: { id: true, firstName: true, lastName: true },
        },
        addons: {
          select: { priceAtOrder: true, quantity: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate revenue by realtor and date
    const revenueByRealtor: Record<string, { realtor: string; totalOrders: number; totalRevenue: number }> = {};
    
    orders.forEach((order) => {
      const rKey = order.realtor?.id || 'UNKNOWN';
      if (!revenueByRealtor[rKey]) {
        revenueByRealtor[rKey] = {
          realtor: order.realtor ? `${order.realtor.firstName} ${order.realtor.lastName}` : 'Unknown',
          totalOrders: 0,
          totalRevenue: 0,
        };
      }
      revenueByRealtor[rKey].totalOrders += 1;
      // Calculate revenue from addons
      const orderRevenue = order.addons?.reduce((sum, addon) => sum + (addon.priceAtOrder * addon.quantity), 0) || 0;
      revenueByRealtor[rKey].totalRevenue += orderRevenue;
    });

    // Format for CSV
    const csvData = Object.values(revenueByRealtor).map((item) => ({
      'Realtor': item.realtor,
      'Total Orders': item.totalOrders,
      'Total Revenue': formatCurrency(item.totalRevenue),
      'Average Order Value': formatCurrency(item.totalRevenue / item.totalOrders),
    }));

    // Add summary row
    const totalRevenue = Object.values(revenueByRealtor).reduce((sum, item) => sum + item.totalRevenue, 0);
    const totalOrders = Object.values(revenueByRealtor).reduce((sum, item) => sum + item.totalOrders, 0);
    
    csvData.push({
      'Realtor': 'TOTAL',
      'Total Orders': totalOrders,
      'Total Revenue': formatCurrency(totalRevenue),
      'Average Order Value': totalOrders > 0 ? formatCurrency(totalRevenue / totalOrders) : '$0.00',
    });

    if (format === 'pdf') {
      // For now, return CSV
      return generateCSVResponse(csvData, 'revenue');
    }

    return generateCSVResponse(csvData, 'revenue');
  } catch (error) {
    console.error('Revenue report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate revenue report' },
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
