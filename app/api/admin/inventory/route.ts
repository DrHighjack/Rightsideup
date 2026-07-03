import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getInventoryPriceServiceType, updateMasterPrice } from '@/lib/pricing';

const HARDCODED_INVENTORY_IMAGE_BY_NAME: Record<string, string> = {
  'black flyer box': '/uploads/inventory/blackflyerbox.png',
  'black signpost': '/uploads/inventory/black_signpost.png',
  'black sign post': '/uploads/inventory/black_signpost.png',
  'custom signpost': '/uploads/inventory/custom_signpost.png',
  'custom color sign post': '/uploads/inventory/custom_signpost.png',
  'for lease rider': '/uploads/inventory/forleaserider.png',
  'for sale rider': '/uploads/inventory/forleaserider.png',
  'custom rider change': '/uploads/inventory/forleaserider.png',
  'white flyer box': '/uploads/inventory/whiteflyerbox.png',
  // HEIC may fail in browser rendering on some clients; use safe fallback for now.
  'white signpost': '/uploads/inventory/black_signpost.png',
};

function resolveInventoryImageUrl(name: string, imageUrl: string | null): string | null {
  const key = name.trim().toLowerCase();
  if (HARDCODED_INVENTORY_IMAGE_BY_NAME[key]) {
    return HARDCODED_INVENTORY_IMAGE_BY_NAME[key];
  }
  return imageUrl;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const items = await prisma.inventoryItem.findMany({
      where: category && category !== 'ALL' ? { category } : {},
      include: {
        printers: {
          include: {
            printer: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const resolvedItems = items.map((item) => ({
      ...item,
      imageUrl: resolveInventoryImageUrl(item.name, item.imageUrl),
    }));

    return NextResponse.json({ items: resolvedItems });
  } catch (error) {
    console.error('Inventory GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      category,
      description,
      imageUrl,
      totalQuantity,
      availableQuantity,
      lowStockThreshold,
      isOrderable,
      pricePerUnit,
      printerIds = [],
    } = body;

    if (!name || !category) {
      return NextResponse.json(
        { error: 'Name and category are required' },
        { status: 400 }
      );
    }

    const item = await prisma.inventoryItem.create({
      data: {
        name,
        category,
        description,
        imageUrl,
        totalQuantity: totalQuantity || 0,
        availableQuantity: availableQuantity || 0,
        lowStockThreshold: lowStockThreshold || 5,
        isOrderable: isOrderable !== false,
        pricePerUnit,
      },
    });

    if (typeof pricePerUnit === 'number' && pricePerUnit >= 0) {
      await updateMasterPrice(getInventoryPriceServiceType(item.id), pricePerUnit);
    }

    // Link printers if provided
    if (printerIds.length > 0) {
      await Promise.all(
        printerIds.map((printerId: string) =>
          prisma.inventoryItemPrinter.create({
            data: {
              inventoryItemId: item.id,
              printerId,
            },
          })
        )
      );
    }

    const createdItem = await prisma.inventoryItem.findUnique({
      where: { id: item.id },
      include: {
        printers: {
          include: {
            printer: true,
          },
        },
      },
    });

    return NextResponse.json({ item: createdItem }, { status: 201 });
  } catch (error) {
    console.error('Inventory POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create inventory item' },
      { status: 500 }
    );
  }
}
