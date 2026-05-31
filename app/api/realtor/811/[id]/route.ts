/**
 * GET /api/realtor/811/[id] — Returns single 811 ticket detail with utility lines
 * Auth: REALTOR or TC (can only access their own tickets)
 */

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(
  _: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = (session.user as any).role;
    const ticketId = params.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ticket = await prisma.ticket811.findUnique({
      where: { id: ticketId },
      include: {
        realtor: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        clearedByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: '811 ticket not found' },
        { status: 404 }
      );
    }

    // Auth check: realtor can only see their own tickets, TC can see their linked agents' tickets
    if (userRole === 'REALTOR' && ticket.realtorId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (userRole === 'TC') {
      if (!ticket.realtorId) {
        return NextResponse.json(
          { error: 'Unauthorized - ticket has no realtor assigned' },
          { status: 403 }
        );
      }

      const isLinked = await prisma.tCAgentLink.findUnique({
        where: { tcUserId_agentUserId: { tcUserId: userId, agentUserId: ticket.realtorId } },
      });

      if (!isLinked && ticket.realtorId !== userId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error('Error fetching 811 ticket:', error);
    return NextResponse.json(
      { error: 'Failed to fetch 811 ticket' },
      { status: 500 }
    );
  }
}
