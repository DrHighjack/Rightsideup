import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const printers = await prisma.signPrinter.findMany({
      where: { isActive: true },
      include: {
        items: {
          include: {
            inventoryItem: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ printers });
  } catch (error) {
    console.error('Printers GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch printers' },
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
    const { name, website, phone, email, notes } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Printer name is required' },
        { status: 400 }
      );
    }

    const printer = await prisma.signPrinter.create({
      data: {
        name,
        website,
        phone,
        email,
        notes,
      },
    });

    return NextResponse.json({ printer }, { status: 201 });
  } catch (error) {
    console.error('Printers POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create printer' },
      { status: 500 }
    );
  }
}
