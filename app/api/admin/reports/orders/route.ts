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

    // Fetch orders with details
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        realtor: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        items: {
          include: {
            sign: {
              select: { signNumber: true, type: true },
            },
          },
        },
        addons: {
          include: {
            inventoryItem: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format data for CSV
    const csvData = orders.map((order) => ({
      'Order Number': order.orderNumber,
      'Realtor': order.realtor ? `${order.realtor.firstName} ${order.realtor.lastName}` : 'N/A',
      'Realtor Email': order.realtor?.email || 'N/A',
      'Property Address': order.address,
      'Signs': order.items?.map((item) => item.sign?.signNumber || 'N/A').join('; ') || 'None',
      'Sign Types': order.items?.map((item) => item.sign?.type || 'N/A').join('; ') || 'N/A',
      'Addons': order.addons?.map((a) => `${a.inventoryItem?.name} (qty: ${a.quantity})`).join('; ') || 'None',
      'Total Quantity': order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
      'Total Addon Price': formatCurrency(order.addons?.reduce((sum, a) => sum + (a.priceAtOrder * a.quantity), 0) || 0),
      'Status': order.status,
      'Scheduled Date': order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString() : 'N/A',
      'Notes': order.notes || '',
      'Created': new Date(order.createdAt).toLocaleString(),
    }));

    if (format === 'pdf') {
      // For now, return CSV. PDF would require additional PDF generation logic
      return generateCSVResponse(csvData, 'orders');
    }

    return generateCSVResponse(csvData, 'orders');
  } catch (error) {
    console.error('Orders report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate orders report' },
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
