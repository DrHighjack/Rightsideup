import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/quickbooks/disconnect
 * Disconnect QuickBooks integration
 */
export async function POST(_req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const connection = await prisma.qBOConnection.findFirst({
      where: { isConnected: true },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'No active QuickBooks connection' },
        { status: 404 }
      );
    }

    // Mark as disconnected
    await prisma.qBOConnection.update({
      where: { id: connection.id },
      data: {
        isConnected: false,
        disconnectedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('QB Disconnect Error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
