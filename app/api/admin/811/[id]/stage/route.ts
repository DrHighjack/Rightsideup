/**
 * PUT /api/admin/811/[id]/stage — Admin manually updates ticket stage
 * Auth: ADMIN only
 * Body: { stage }
 * Stage options: REQUESTED, TICKET_SUBMITTED, LINES_RESPONDED, CLEAR
 */

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ticketId = params.id;
    const body = await request.json();
    const { stage } = body;

    if (!stage) {
      return NextResponse.json(
        { error: 'stage is required' },
        { status: 400 }
      );
    }

    const validStages = ['REQUESTED', 'TICKET_SUBMITTED', 'LINES_RESPONDED', 'CLEAR'];
    if (!validStages.includes(stage)) {
      return NextResponse.json(
        { error: `Invalid stage. Must be one of: ${validStages.join(', ')}` },
        { status: 400 }
      );
    }

    const ticket = await prisma.ticket811.findUnique({
      where: { id: ticketId },
      include: {
        matchedOrderIds: true,
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: '811 ticket not found' },
        { status: 404 }
      );
    }

    // If advancing to CLEAR stage, release any orders on hold
    if (stage === 'CLEAR' && ticket.matchedOrderIds && ticket.matchedOrderIds.length > 0) {
      await Promise.all(
        ticket.matchedOrderIds.map((orderId) =>
          prisma.order.update({
            where: { id: orderId },
            data: {
              status: 'SCHEDULED', // Release from hold
              heldAt: null,
              holdReason: null,
            },
          })
        )
      );
    }

    const clearanceDate = stage === 'CLEAR' && !ticket.clearanceDate ? new Date() : ticket.clearanceDate;

    const updatedTicket = await prisma.ticket811.update({
      where: { id: ticketId },
      data: {
        stage,
        clearanceDate,
        updatedAt: new Date(),
      },
      include: {
        realtor: {
          select: { id: true, firstName: true, lastName: true },
        },
        clearedByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    const releasedOrders = stage === 'CLEAR' && ticket.matchedOrderIds ? ticket.matchedOrderIds.length : 0;

    return NextResponse.json({
      ticket: updatedTicket,
      message: `Ticket stage updated to ${stage}`,
      ordersReleased: releasedOrders > 0 ? `${releasedOrders} order(s) released from hold` : null,
    });
  } catch (error) {
    console.error('Error updating ticket stage:', error);
    return NextResponse.json(
      { error: 'Failed to update ticket stage' },
      { status: 500 }
    );
  }
}
