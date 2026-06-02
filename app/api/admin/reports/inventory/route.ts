import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { objectsToCSV, formatDateForFilename, formatCurrency } from '@/lib/reports';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all active inventory items
    const items = await prisma.inventoryItem.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        totalQuantity: true,
        availableQuantity: true,
        lowStockThreshold: true,
        pricePerUnit: true,
        isOrderable: true,
      },
      orderBy: { name: 'asc' },
    });

    // Format for CSV
    const csvData = items.map((item) => ({
      'Item Name': item.name,
      'Category': item.category,
      'Description': item.description || 'N/A',
      'Total Quantity': item.totalQuantity,
      'Available Quantity': item.availableQuantity,
      'Low Stock Threshold': item.lowStockThreshold,
      'Price Per Unit': item.pricePerUnit !== null ? formatCurrency(item.pricePerUnit) : 'N/A',
      'Orderable': item.isOrderable ? 'Yes' : 'No',
      'Stock Status': item.availableQuantity < item.lowStockThreshold ? 'Low' : 'Adequate',
    }));

    return generateCSVResponse(csvData, 'inventory');
  } catch (error) {
    console.error('Inventory report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate inventory report' },
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
