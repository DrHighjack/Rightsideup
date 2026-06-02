import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    const { name, website, phone, email, notes } = body;

    const printer = await prisma.signPrinter.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        website,
        phone,
        email,
        notes,
      },
    });

    return NextResponse.json({ printer });
  } catch (error) {
    console.error('Printer PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update printer' },
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

    // Soft delete - set isActive to false
    const printer = await prisma.signPrinter.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({ printer, message: 'Printer soft deleted' });
  } catch (error) {
    console.error('Printer DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete printer' },
      { status: 500 }
    );
  }
}
