import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getInventoryPriceServiceType } from '@/lib/pricing';

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

    // Resolve effective add-on prices for REALTOR users only.
    const effectivePriceMap = new Map<string, number | null>();
    if (userRole === 'REALTOR') {
      const pricedItems = items.filter((item) => item.pricePerUnit !== null);
      const serviceTypes = pricedItems.map((item) => getInventoryPriceServiceType(item.id));

      if (serviceTypes.length > 0) {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { brokerageId: true },
        });

        const [masterPrices, userOverrides, brokerageOverrides] = await Promise.all([
          prisma.masterPrice.findMany({
            where: { serviceType: { in: serviceTypes }, isActive: true },
            select: { serviceType: true, amountCents: true },
          }),
          prisma.priceOverride.findMany({
            where: {
              serviceType: { in: serviceTypes },
              userId: session.user.id,
            },
            select: { serviceType: true, amountCents: true },
          }),
          user?.brokerageId
            ? prisma.priceOverride.findMany({
                where: {
                  serviceType: { in: serviceTypes },
                  brokerageId: user.brokerageId,
                },
                select: { serviceType: true, amountCents: true },
              })
            : Promise.resolve([]),
        ]);

        const masterMap = new Map(masterPrices.map((p) => [p.serviceType, p.amountCents]));
        const userOverrideMap = new Map(userOverrides.map((p) => [p.serviceType, p.amountCents]));
        const brokerageOverrideMap = new Map(
          brokerageOverrides.map((p) => [p.serviceType, p.amountCents])
        );

        for (const item of pricedItems) {
          const key = getInventoryPriceServiceType(item.id);
          const effectivePrice =
            userOverrideMap.get(key) ??
            brokerageOverrideMap.get(key) ??
            masterMap.get(key) ??
            item.pricePerUnit;
          effectivePriceMap.set(item.id, effectivePrice);
        }
      }
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
      pricePerUnit:
        userRole === 'REALTOR'
          ? effectivePriceMap.get(item.id) ?? item.pricePerUnit
          : item.pricePerUnit,
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
