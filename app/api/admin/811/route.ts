import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pollAndProcess } from '@/lib/emailPoller';
import { get811ManualTicketCreatedAlertEmail, sendEmail } from '@/lib/email';

// GET /api/admin/811 - List tickets with optional filters
// Query params: status (ACTIVE, NEEDS_REVIEW, CLEARED, DISMISSED, NEW)
//               startDate, endDate (ISO format for date range)
//               orderBy (createdAt, ticketNumber)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const orderBy = searchParams.get('orderBy') || 'createdAt';

    // Build where clause
    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Fetch tickets
    const tickets = await prisma.ticket811.findMany({
      where,
      orderBy: {
        [orderBy]: 'desc',
      },
      include: {
        clearedByUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    // Get matched order details
    const ticketsWithOrders = await Promise.all(
      tickets.map(async (ticket) => {
        const matchedOrders = await prisma.order.findMany({
          where: { id: { in: ticket.matchedOrderIds } },
          select: {
            id: true,
            orderNumber: true,
            address: true,
            status: true,
            realtor: { select: { email: true } },
          },
        });
        return { ...ticket, matchedOrders };
      })
    );

    return NextResponse.json(ticketsWithOrders);
  } catch (error) {
    console.error('[811API] GET error:', error);
    return NextResponse.json({ error: (error as any).message }, { status: 500 });
  }
}

// POST /api/admin/811 - Create ticket manually OR trigger poll
// Body: { action: 'create' | 'poll' }
// For 'create': { ticketNumber, sourceEmail, emailSubject, emailBody, parsedAddress?, workStartDate? }
// For 'poll': no additional params needed
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'poll') {
      // Manually trigger poll cycle
      console.log('[811API] Manual poll triggered by admin');
      await pollAndProcess();
      return NextResponse.json({ success: true, message: 'Poll cycle completed' });
    }

    if (action === 'create') {
      const { ticketNumber, sourceEmail, emailSubject, emailBody, parsedAddress, workStartDate } =
        body;

      if (!ticketNumber || !sourceEmail || !emailSubject || !emailBody) {
        return NextResponse.json(
          { error: 'Missing required fields: ticketNumber, sourceEmail, emailSubject, emailBody' },
          { status: 400 }
        );
      }

      // Create ticket
      const ticket = await prisma.ticket811.create({
        data: {
          ticketNumber,
          sourceEmail,
          emailSubject,
          emailBody,
          parsedAddress: parsedAddress || undefined,
          workStartDate: workStartDate ? new Date(workStartDate) : undefined,
          status: 'NEEDS_REVIEW', // manually created tickets start as NEEDS_REVIEW
        },
      });

      // Send admin alert
      const adminEmail = process.env.ADMIN_ALERT_EMAIL;
      if (adminEmail) {
        try {
          const manualTicketEmail = get811ManualTicketCreatedAlertEmail(
            ticketNumber,
            sourceEmail,
            emailSubject,
            parsedAddress || 'Not parsed',
            `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin/811/${ticket.id}`
          );

          await sendEmail({
            to: adminEmail,
            subject: manualTicketEmail.subject,
            html: manualTicketEmail.html,
          });
        } catch (emailError) {
          console.error(`Failed to send admin email:`, emailError);
          // Don't fail the whole operation if email fails
        }
      }

      return NextResponse.json(ticket);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[811API] POST error:', error);
    return NextResponse.json({ error: (error as any).message }, { status: 500 });
  }
}
