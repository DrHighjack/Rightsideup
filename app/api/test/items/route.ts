import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Try to get all inventory items
    const count = await prisma.inventoryItem.count();
    
    const printerCount = await prisma.signPrinter.count();
    
    await prisma.$disconnect();
    
    return NextResponse.json({
      inventoryItemCount: count,
      signPrinterCount: printerCount,
      status: 'ok'
    });
  } catch (error) {
    console.error('Test error:', error);
    await prisma.$disconnect();
    return NextResponse.json({
      error: String(error),
      status: 'failed'
    }, { status: 500 });
  }
}
