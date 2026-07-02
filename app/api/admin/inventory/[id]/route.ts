import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getInventoryPriceServiceType, updateMasterPrice } from '@/lib/pricing';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Update the item
    await prisma.inventoryItem.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        description,
        imageUrl,
        ...(typeof totalQuantity === 'number' && { totalQuantity }),
        ...(typeof availableQuantity === 'number' && { availableQuantity }),
        ...(lowStockThreshold && { lowStockThreshold }),
        ...(typeof isOrderable === 'boolean' && { isOrderable }),
        ...(pricePerUnit !== undefined && { pricePerUnit }),
      },
      include: {
        printers: {
          include: {
            printer: true,
          },
        },
      },
    });

    if (typeof pricePerUnit === 'number' && pricePerUnit >= 0) {
      await updateMasterPrice(getInventoryPriceServiceType(params.id), pricePerUnit);
    }

    // Update printers if provided
    if (printerIds.length >= 0) {
      // Delete existing printer links
      await prisma.inventoryItemPrinter.deleteMany({
        where: { inventoryItemId: params.id },
      });

      // Create new printer links
      if (printerIds.length > 0) {
        await Promise.all(
          printerIds.map((printerId: string) =>
            prisma.inventoryItemPrinter.create({
              data: {
                inventoryItemId: params.id,
                printerId,
              },
            })
          )
        );
      }
    }

    const item = await prisma.inventoryItem.findUnique({
      where: { id: params.id },
      include: {
        printers: {
          include: {
            printer: true,
          },
        },
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Inventory PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update inventory item' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Soft delete - just set isActive to false
    const item = await prisma.inventoryItem.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({ item, message: 'Item soft deleted' });
  } catch (error) {
    console.error('Inventory DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete inventory item' },
      { status: 500 }
    );
  }
}
