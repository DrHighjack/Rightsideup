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

    // Build where clause based on role
    const whereClause: any = {
      isActive: true,
    };

    // For REALTOR and TC users, only show SIGN category items
    // Admin users see all categories (SIGN, FLYER_BOX, RIDER, OTHER, etc.)
    if (userRole === 'REALTOR' || userRole === 'TC') {
      whereClause.category = 'SIGN';
    }

    // Fetch active inventory items with their linked printers
    const items = await prisma.inventoryItem.findMany({
      where: whereClause,
      include: {
        printers: {
          include: {
            printer: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // For non-admin users, also fetch their custom signs
    let customSignIds: string[] = [];
    if (userRole === 'REALTOR' || userRole === 'TC') {
      const customSigns = await prisma.sign.findMany({
        where: {
          type: 'Custom',
          assignedToUserId: session.user.id,
        },
        select: { id: true },
      });
      customSignIds = customSigns.map(s => s.id);
    }

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
      showQuantity: userRole === 'ADMIN', // Only show quantities to admins
      printers: item.printers.map((ip) => ({
        id: ip.printer.id,
        name: ip.printer.name,
        website: ip.printer.website,
        phone: ip.printer.phone,
        email: ip.printer.email,
      })),
    }));

    return NextResponse.json({ 
      items: formattedItems,
      userRole,
      hasCustomSigns: customSignIds.length > 0,
    });
  } catch (error) {
    console.error('Inventory items fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory items' },
      { status: 500 }
    );
  }
}
