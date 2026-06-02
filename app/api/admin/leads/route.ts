import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Check authentication
    const session = await auth();
    
    if (!session || !session.user) {
      console.warn('[ADMIN LEADS API] Unauthorized - no session');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check admin role
    const userRole = (session.user as any)?.role;
    if (userRole !== 'ADMIN') {
      console.warn('[ADMIN LEADS API] Forbidden - user role:', userRole);
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Fetch all leads, sorted by newest first
    const leads = await prisma.instaads.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        brokerage: true,
        createdAt: true,
      },
    });

    console.log('[ADMIN LEADS API] Retrieved', leads.length, 'leads');

    return NextResponse.json({
      success: true,
      leads: leads.map(lead => ({
        ...lead,
        createdAt: lead.createdAt.toISOString(),
      })),
      count: leads.length,
    });
  } catch (error) {
    console.error('[ADMIN LEADS API] Error:', error instanceof Error ? error.message : String(error));
    console.error('[ADMIN LEADS API] Full error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch leads', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
