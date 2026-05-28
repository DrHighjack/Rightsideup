import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { auth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLog';
import { ActivityAction } from '@prisma/client';

// GET /api/admin/811/[id] - Get ticket detail with matched orders
export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    console.log('[811API GET] Fetching ticket:', id);

    const ticket = await prisma.ticket811.findUnique({
      where: { id },
      include: {
        clearedByUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Get matched orders
    const matchedOrders = await prisma.order.findMany({
      where: { id: { in: ticket.matchedOrderIds } },
    });

    return NextResponse.json({
      ...ticket,
      matchedOrders,
    });
  } catch (error) {
    console.error('[811API GET] Error:', error);
    return NextResponse.json({ error: (error as any).message }, { status: 500 });
  }
}

// PUT /api/admin/811/[id] - Update ticket (clear, dismiss, or general update)
// Body: { action: 'clear' | 'dismiss' | 'update' }
// For 'clear': { adminNotes? } - releases held orders back to SCHEDULED
// For 'dismiss': { adminNotes? } - marks as false positive
// For 'update': { parsedAddress?, adminNotes?, matchedOrderIds? }
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    const { id } = params;
    const body = await request.json();
    const { action } = body;

    console.log('[811API PUT] Updating ticket:', id, 'Action:', action);

    // Verify ticket exists
    const ticket = await prisma.ticket811.findUnique({
      where: { id },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (action === 'clear') {
      console.log('[811API] Clearing ticket:', id);
      // Clear the ticket and release held orders back to SCHEDULED
      const { adminNotes } = body;

      // Get all matched orders
      const matchedOrders = await prisma.order.findMany({
        where: { id: { in: ticket.matchedOrderIds } },
        include: { realtor: { select: { email: true } } },
      });

      console.log('[811API] Found', matchedOrders.length, 'matched orders');

      // Update all matched orders back to SCHEDULED and send confirmation emails
      await Promise.all(
        matchedOrders.map(async (order) => {
          try {
            // Update order status
            console.log('[811API] Updating order:', order.id, 'to SCHEDULED');
            await prisma.order.update({
              where: { id: order.id },
              data: {
                status: 'SCHEDULED',
                holdReason: null,
                heldAt: null,
              },
            });

            // Send confirmation email to realtor if they exist
            if (order.realtor?.email) {
              try {
                await sendEmail({
                  to: order.realtor.email,
                  subject: `Order ${order.orderNumber} - 811 Hold Released`,
                  html: `
                    <h3>811 Hold Released</h3>
                    <p>The 811 ticket hold on order <strong>${order.orderNumber}</strong> has been cleared.</p>
                    <p>Your order is now back to SCHEDULED status.</p>
                    <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
                    ${adminNotes ? `<p><strong>Notes:</strong> ${adminNotes}</p>` : ''}
                  `,
                });
              } catch (emailError) {
                console.error(`Failed to send email to realtor ${order.realtor?.email}:`, emailError);
                // Don't fail the whole operation if email fails
              }
            }
          } catch (orderError) {
            console.error(`Failed to update order ${order.id}:`, orderError);
            throw orderError;
          }
        })
      );

      // Send admin notification
      const adminEmail = process.env.ADMIN_ALERT_EMAIL;
      if (adminEmail) {
        try {
          await sendEmail({
            to: adminEmail,
            subject: `811 Ticket Cleared: ${ticket.ticketNumber}`,
            html: `
              <h3>811 Ticket Cleared</h3>
              <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
              <p><strong>Orders Released:</strong> ${matchedOrders.length}</p>
              <p><strong>Order Numbers:</strong> ${matchedOrders.map((o) => o.orderNumber).join(', ')}</p>
              ${adminNotes ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>` : ''}
            `,
          });
        } catch (emailError) {
          console.error(`Failed to send admin email:`, emailError);
          // Don't fail the whole operation if email fails
        }
      }

      // Update ticket status to CLEARED
      const updatedTicket = await prisma.ticket811.update({
        where: { id },
        data: {
          status: 'CLEARED',
          clearedAt: new Date(),
          adminNotes: adminNotes || ticket.adminNotes,
        },
      });

      // Log activity
      if (session?.user?.id) {
        await logActivity({
          userId: session.user.id,
          action: ActivityAction.TICKET_811_CLEARED,
          entityType: 'Ticket811',
          entityId: ticket.id,
          description: `811 ticket cleared - ${matchedOrders.length} orders released`,
          metadata: {
            ticketNumber: ticket.ticketNumber,
            ordersReleased: matchedOrders.map((o) => o.orderNumber),
            adminNotes,
          },
        });
      }

      console.log('[811API] Ticket cleared successfully');
      return NextResponse.json({
        success: true,
        message: `Ticket cleared. ${matchedOrders.length} orders released back to SCHEDULED.`,
        ticket: updatedTicket,
      });
    }

    if (action === 'dismiss') {
      // Mark as false positive - does NOT release orders
      const { adminNotes } = body;

      // Update ticket status to DISMISSED
      const updatedTicket = await prisma.ticket811.update({
        where: { id },
        data: {
          status: 'DISMISSED',
          adminNotes: adminNotes || ticket.adminNotes,
        },
      });

      // Send admin notification
      const adminEmail = process.env.ADMIN_ALERT_EMAIL;
      if (adminEmail) {
        try {
          await sendEmail({
            to: adminEmail,
            subject: `811 Ticket Dismissed: ${ticket.ticketNumber}`,
            html: `
              <h3>811 Ticket Dismissed</h3>
              <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
              <p>This ticket has been marked as a false positive. Orders remain on hold.</p>
              ${adminNotes ? `<p><strong>Reason:</strong> ${adminNotes}</p>` : ''}
            `,
          });
        } catch (emailError) {
          console.error(`Failed to send admin email:`, emailError);
          // Don't fail the whole operation if email fails
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Ticket dismissed as false positive. Orders remain on hold.',
        ticket: updatedTicket,
      });
    }

    if (action === 'update') {
      // General update - update notes, address, or matched order IDs
      const { parsedAddress, adminNotes, matchedOrderIds } = body;

      const updateData: any = {};
      if (parsedAddress !== undefined) updateData.parsedAddress = parsedAddress;
      if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
      if (matchedOrderIds !== undefined) updateData.matchedOrderIds = matchedOrderIds;

      const updatedTicket = await prisma.ticket811.update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json(updatedTicket);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[811API PUT] Error:', error);
    console.error('[811API PUT] Error stack:', error?.stack);
    const errorMessage = error?.message || String(error);
    const errorResponse = {
      error: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      type: error?.constructor?.name,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
