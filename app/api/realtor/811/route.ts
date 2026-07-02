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

    const ticketInclude = {
      realtor: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      clearedByUser: {
        select: { id: true, firstName: true, lastName: true },
      },
      order: {
        select: { id: true, orderNumber: true, address: true, addressLat: true, addressLng: true },
      },
    } as const;

    // REALTOR sees only their tickets, TC sees all tickets (linked agents' tickets)
    let tickets;

    if (userRole === 'REALTOR') {
      tickets = await prisma.ticket811.findMany({
        where: {
          OR: [
            { realtorId: userId },
            { order: { is: { realtorId: userId } } },
          ],
        },
        include: ticketInclude,
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
        where: {
          OR: [
            { realtorId: { in: agentIds } },
            { order: { is: { realtorId: { in: agentIds } } } },
          ],
        },
        include: ticketInclude,
        orderBy: { createdAt: 'desc' },
      });
    } else {
      return NextResponse.json(
        { error: 'Only realtors and TCs can view 811 tickets' },
        { status: 403 }
      );
    }

    // Sanitize utility lines to hide contact information from realtor
    const sanitized = tickets.map((ticket: any) => {
      const safeUtilityLines = (ticket.utilityLines as any[] || []).map(
        (line: any) => ({
          name: line.name,
          status: line.status,
          respondedAt: line.respondedAt,
          // NO contact information returned
        })
      );

      return {
        ...ticket,
        parsedAddress:
          ticket.parsedAddress ||
          (ticket.ticketNumber ? `Ticket #${ticket.ticketNumber}` : '811 Ticket'),
        utilityLines: safeUtilityLines,
      };
    });

    return NextResponse.json({ tickets: sanitized });
  } catch (error) {
    console.error('Error fetching 811 tickets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch 811 tickets' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/realtor/811 — Create a manual 811 ticket by ticket number
 * Auth: REALTOR or TC
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== 'REALTOR' && userRole !== 'TC') {
      return NextResponse.json(
        { error: 'Only realtors and TCs can create tickets from this page' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const rawTicketNumber = typeof body?.ticketNumber === 'string' ? body.ticketNumber.trim() : '';
    const ticketNumber = rawTicketNumber.replace(/\s+/g, '');
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';

    if (!ticketNumber) {
      return NextResponse.json(
        { error: 'Ticket number is required' },
        { status: 400 }
      );
    }

    const invalidChars = /[^\d-]/.test(ticketNumber);
    const digitCount = ticketNumber.replace(/-/g, '').length;
    const malformedDashes = ticketNumber.startsWith('-') || ticketNumber.endsWith('-') || ticketNumber.includes('--');

    if (invalidChars || malformedDashes || digitCount < 6) {
      return NextResponse.json(
        { error: 'Ticket number must contain at least 6 digits and may only include numbers and single dashes' },
        { status: 400 }
      );
    }

    if (!orderId) {
      return NextResponse.json(
        { error: 'Property selection is required' },
        { status: 400 }
      );
    }

    let orderWhere: any = { id: orderId };

    if (userRole === 'REALTOR') {
      orderWhere.realtorId = session.user.id;
    } else {
      const linkedAgents = await prisma.tCAgentLink.findMany({
        where: { tcUserId: session.user.id },
        select: { agentUserId: true },
      });
      const linkedAgentIds = linkedAgents.map((link) => link.agentUserId);
      orderWhere.realtorId = { in: linkedAgentIds.length > 0 ? linkedAgentIds : [''] };
    }

    const order = await prisma.order.findFirst({
      where: orderWhere,
      select: {
        id: true,
        address: true,
        realtorId: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Selected property was not found' },
        { status: 404 }
      );
    }

    const existing = await prisma.ticket811.findFirst({
      where: {
        OR: [
          {
            ticketNumber,
            realtorId: order.realtorId,
          },
          {
            orderId,
          },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A ticket already exists for this property or ticket number' },
        { status: 409 }
      );
    }

    const ticket = await prisma.ticket811.create({
      data: {
        ticketNumber,
        sourceEmail: 'manual-entry@northshoresignco.local',
        emailSubject: `Manual 811 Ticket Entry - ${ticketNumber}`,
        emailBody: `Manually created by realtor ${session.user.id}`,
        parsedAddress: order.address,
        status: 'NEEDS_REVIEW',
        stage: 'TICKET_SUBMITTED',
        matchedOrderIds: [],
        orderId,
        realtorId: order.realtorId,
        requestedDate: new Date(),
        ticketSubmittedAt: new Date(),
        utilityLines: [],
      },
      include: {
        realtor: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        clearedByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        order: {
          select: { id: true, orderNumber: true, address: true, addressLat: true, addressLng: true },
        },
      },
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error('Error creating manual 811 ticket:', error);
    return NextResponse.json(
      { error: 'Failed to create ticket' },
      { status: 500 }
    );
  }
}
