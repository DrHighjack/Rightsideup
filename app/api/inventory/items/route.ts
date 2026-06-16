import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    
    // Check authentication
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check authorization - REALTOR, TC, or ADMIN
    const userRole = (session.user as any).role as string | undefined;
    if (!userRole || !['REALTOR', 'TC', 'ADMIN'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all active inventory items with their linked printers
    const items = await prisma.inventoryItem.findMany({
      where: {
        isActive: true,
      },
      include: {
        printers: {
          include: {
            printer: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Format response
    const formattedItems = items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      imageUrl: item.imageUrl,
      availableQuantity: item.availableQuantity,
      totalQuantity: item.totalQuantity,
      isOrderable: item.isOrderable,
      pricePerUnit: item.pricePerUnit,
      lowStockThreshold: item.lowStockThreshold,
      printers: item.printers.map((ip) => ({
        id: ip.printer.id,
        name: ip.printer.name,
        website: ip.printer.website,
        phone: ip.printer.phone,
        email: ip.printer.email,
      })),
    }));

    return NextResponse.json({ items: formattedItems });
  } catch (error) {
    console.error('Inventory items fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory items' },
      { status: 500 }
    );
  }
}
