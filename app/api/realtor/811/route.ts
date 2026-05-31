/**
 * GET /api/realtor/811 — Returns all 811 tickets for the logged-in realtor
 * Auth: REALTOR or TC
 */

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const userId = session.user.id;

    // REALTOR sees only their tickets, TC sees all tickets (linked agents' tickets)
    let tickets;

    if (userRole === 'REALTOR') {
      tickets = await prisma.ticket811.findMany({
        where: { realtorId: userId },
        include: {
          realtor: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          clearedByUser: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else if (userRole === 'TC') {
      // TC sees tickets for their linked agents
      const linkedAgents = await prisma.tCAgentLink.findMany({
        where: { tcUserId: userId },
        select: { agentUserId: true },
      });

      const agentIds = linkedAgents.map((link) => link.agentUserId);

      tickets = await prisma.ticket811.findMany({
        where: { realtorId: { in: agentIds } },
        include: {
          realtor: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          clearedByUser: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      return NextResponse.json(
        { error: 'Only realtors and TCs can view 811 tickets' },
        { status: 403 }
      );
    }

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error('Error fetching 811 tickets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch 811 tickets' },
      { status: 500 }
    );
  }
}
