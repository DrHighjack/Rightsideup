import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pollAndProcess } from '@/lib/emailPoller';
import { get811ManualTicketCreatedAlertEmail, sendEmail } from '@/lib/email';
import { auth } from '@/lib/auth';

// GET /api/admin/811 - List tickets with optional filters
// Query params: status (ACTIVE, NEEDS_REVIEW, CLEARED, DISMISSED, NEW)
//               startDate, endDate (ISO format for date range)
//               orderBy (createdAt, ticketNumber)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    if (searchParams.get('availableOrders') === '1') {
      const orders = await prisma.order.findMany({
        where: {
          status: { in: ['PENDING', 'SCHEDULED', 'ON_HOLD'] },
          self811Accepted: false,
          ticket811: null,
        },
        select: {
          id: true,
          orderNumber: true,
          address: true,
          realtor: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ orders });
    }

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
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'poll') {
      // Manually trigger poll cycle
      console.log('[811API] Manual poll triggered by admin');
      await pollAndProcess();
      return NextResponse.json({ success: true, message: 'Poll cycle completed' });
    }

    if (action === 'create') {
      const { ticketNumber, emailSubject, emailBody, workStartDate, orderId } = body;

      if (!ticketNumber || !emailSubject || !emailBody || !orderId) {
        return NextResponse.json(
          { error: 'Ticket number and pending listing are required' },
          { status: 400 }
        );
      }

      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          status: { in: ['PENDING', 'SCHEDULED', 'ON_HOLD'] },
          self811Accepted: false,
          ticket811: null,
        },
        select: { id: true, address: true, realtorId: true },
      });

      if (!order) {
        return NextResponse.json(
          { error: 'The selected listing is no longer eligible for an 811 ticket' },
          { status: 409 }
        );
      }

      const sourceEmail = 'admin-entry@rightsignup.local';
      const ticket = await prisma.ticket811.create({
        data: {
          ticketNumber: String(ticketNumber).trim(),
          sourceEmail,
          emailSubject,
          emailBody,
          parsedAddress: order.address,
          workStartDate: workStartDate ? new Date(workStartDate) : undefined,
          status: 'ACTIVE',
          orderId: order.id,
          realtorId: order.realtorId,
          matchedOrderIds: [order.id],
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
            order.address,
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
