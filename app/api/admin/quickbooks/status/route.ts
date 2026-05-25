import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/quickbooks/status
 * Get current QuickBooks connection status
 */
export async function GET(_req: NextRequest) {
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
      select: {
        id: true,
        realmId: true,
        companyName: true,
        isConnected: true,
        connectedAt: true,
      },
    });

    return NextResponse.json({ connection });
  } catch (error) {
    console.error('QB Status Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
