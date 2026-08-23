/**
 * PUT /api/admin/811/[id]/utilities — Admin updates individual utility line status
 * Auth: ADMIN only
 * Body: { lineName, status, respondedAt? }
 * Updates the utilityLines JSON array
 * Only all CLEAR lines advance the linked order to READY_TO_SCHEDULE.
 */

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

interface UtilityLine {
  name: string;
  status: 'PENDING' | 'RESPONDED' | 'CLEAR' | 'CONFLICT';
  respondedAt?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  responseEmailPendingAt?: string;
  responseEmailSentAt?: string;
}

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
    const { lineName, status, respondedAt } = body;

    if (!lineName || !status) {
      return NextResponse.json(
        { error: 'lineName and status are required' },
        { status: 400 }
      );
    }

    const validStatuses = ['PENDING', 'RESPONDED', 'CLEAR', 'CONFLICT'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be PENDING, RESPONDED, CLEAR, or CONFLICT' },
        { status: 400 }
      );
    }

    const ticket = await prisma.ticket811.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: '811 ticket not found' },
        { status: 404 }
      );
    }

    // Update or create the utility line
    let utilityLines: UtilityLine[] = ((ticket.utilityLines as unknown) as UtilityLine[]) || [];

    const lineIndex = utilityLines.findIndex((line) => line.name === lineName);

    if (lineIndex >= 0) {
      const existingLine = utilityLines[lineIndex];
      const isNewResponse = existingLine.status === 'PENDING' && status !== 'PENDING';
      utilityLines[lineIndex] = {
        ...existingLine,
        status,
        respondedAt: status === 'PENDING' ? undefined : respondedAt || existingLine.respondedAt || new Date().toISOString(),
        responseEmailPendingAt: isNewResponse ? new Date().toISOString() : existingLine.responseEmailPendingAt,
        responseEmailSentAt: isNewResponse ? undefined : existingLine.responseEmailSentAt,
      };
    } else {
      const isResponse = status !== 'PENDING';
      // Add new line
      utilityLines.push({
        name: lineName,
        status,
        respondedAt: isResponse ? respondedAt || new Date().toISOString() : undefined,
        responseEmailPendingAt: isResponse ? new Date().toISOString() : undefined,
      });
    }

    // A response is not clearance. Every listed line must explicitly be CLEAR.
    const allResponded = utilityLines.every((line) =>
      ['CLEAR', 'RESPONDED'].includes(line.status)
    );
    const allClear = utilityLines.length > 0 && utilityLines.every((line) => line.status === 'CLEAR');

    const newStage = allClear ? 'CLEAR' : allResponded ? 'LINES_RESPONDED' : 'TICKET_SUBMITTED';
    const allLinesRespondedAt = allResponded && !ticket.allLinesRespondedAt ? new Date() : ticket.allLinesRespondedAt;
    const relatedOrderIds = Array.from(
      new Set([ticket.orderId, ...ticket.matchedOrderIds].filter((id): id is string => Boolean(id)))
    );

    if (relatedOrderIds.length > 0) {
      if (allClear) {
        await prisma.order.updateMany({
          where: {
            id: { in: relatedOrderIds },
            type: { not: 'REMOVAL' },
            status: { in: ['PENDING', 'CONFIRMED', 'READY_TO_SCHEDULE'] },
          },
          data: { status: 'READY_TO_SCHEDULE', holdReason: null, heldAt: null },
        });
      } else {
        await prisma.order.updateMany({
          where: {
            id: { in: relatedOrderIds },
            type: { not: 'REMOVAL' },
            status: { in: ['READY_TO_SCHEDULE', 'SCHEDULED'] },
          },
          data: { status: 'CONFIRMED' },
        });
      }
    }

    const updatedTicket = await prisma.ticket811.update({
      where: { id: ticketId },
      data: {
        utilityLines: utilityLines as any,
        stage: newStage,
        allLinesRespondedAt,
        clearanceDate: allClear ? ticket.clearanceDate || new Date() : null,
        status: allClear ? 'CLEARED' : ticket.status === 'CLEARED' ? 'ACTIVE' : ticket.status,
        clearedAt: allClear ? ticket.clearedAt || new Date() : null,
        updatedAt: new Date(),
      },
      include: {
        realtor: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json({
      ticket: updatedTicket,
      message: `Utility line '${lineName}' updated to ${status}`,
      stageUpdated: newStage !== ticket.stage ? `Auto-advanced to ${newStage}` : null,
      orderReadyToSchedule: allClear,
    });
  } catch (error) {
    console.error('Error updating utility line:', error);
    return NextResponse.json(
      { error: 'Failed to update utility line' },
      { status: 500 }
    );
  }
}
