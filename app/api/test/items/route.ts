import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
