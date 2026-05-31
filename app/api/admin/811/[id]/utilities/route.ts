/**
 * PUT /api/admin/811/[id]/utilities — Admin updates individual utility line status
 * Auth: ADMIN only
 * Body: { lineName, status, respondedAt? }
 * Updates the utilityLines JSON array
 * If all lines are CLEAR or RESPONDED, auto-update stage to LINES_RESPONDED
 */

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

interface UtilityLine {
  name: string;
  status: 'PENDING' | 'RESPONDED' | 'CLEAR' | 'CONFLICT';
  respondedAt?: string;
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
    let utilityLines: UtilityLine[] = (ticket.utilityLines as UtilityLine[]) || [];

    const lineIndex = utilityLines.findIndex((line) => line.name === lineName);

    if (lineIndex >= 0) {
      // Update existing line
      utilityLines[lineIndex] = {
        name: lineName,
        status,
        respondedAt: respondedAt || utilityLines[lineIndex].respondedAt,
      };
    } else {
      // Add new line
      utilityLines.push({
        name: lineName,
        status,
        respondedAt: respondedAt || undefined,
      });
    }

    // Check if all lines are CLEAR or RESPONDED
    const allResponded = utilityLines.every((line) =>
      ['CLEAR', 'RESPONDED'].includes(line.status)
    );

    // Auto-update stage if all lines responded
    const newStage = allResponded ? 'LINES_RESPONDED' : ticket.stage;
    const allLinesRespondedAt = allResponded && !ticket.allLinesRespondedAt ? new Date() : ticket.allLinesRespondedAt;

    const updatedTicket = await prisma.ticket811.update({
      where: { id: ticketId },
      data: {
        utilityLines: utilityLines as any,
        stage: newStage,
        allLinesRespondedAt,
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
    });
  } catch (error) {
    console.error('Error updating utility line:', error);
    return NextResponse.json(
      { error: 'Failed to update utility line' },
      { status: 500 }
    );
  }
}
