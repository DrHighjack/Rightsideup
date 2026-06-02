import cron from 'node-cron';
import * as Sentry from '@sentry/nextjs';

async function checkInvoiceAging() {
  try {
    // Dynamically import at runtime to avoid webpack bundling issues
    const { prisma } = await import('./prisma');
    const { sendEmail } = await import('./email');

    console.log('[SCHEDULER] Checking invoice aging...');

    // Get all invoices with SENT or OVERDUE status
    const invoices = await prisma.invoice.findMany({
      where: {
        status: {
          in: ['SENT', 'OVERDUE'],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    console.log(`[SCHEDULER] Found ${invoices.length} invoices to check`);

    for (const invoice of invoices) {
      if (!invoice.dueDate) {
        console.log(`[SCHEDULER] Skipping invoice ${invoice.id} - no due date`);
        continue;
      }

      const now = new Date();
      const dueDate = new Date(invoice.dueDate);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // First, update status to OVERDUE if past due date and still SENT
      if (daysOverdue > 0 && invoice.status === 'SENT') {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: 'OVERDUE' },
        });
        console.log(`[SCHEDULER] Invoice ${invoice.id} marked as OVERDUE (${daysOverdue} days past due)`);
      }

      // Check if we should send a reminder
      let shouldSendReminder = false;
      let reminderTrigger = '';

      if (daysOverdue >= 7 && invoice.reminderCount === 0) {
        shouldSendReminder = true;
        reminderTrigger = '7 days overdue (1st reminder)';
      } else if (daysOverdue >= 14 && invoice.reminderCount === 1) {
        shouldSendReminder = true;
        reminderTrigger = '14 days overdue (2nd reminder)';
      } else if (daysOverdue >= 30 && invoice.reminderCount === 2) {
        shouldSendReminder = true;
        reminderTrigger = '30 days overdue (3rd reminder)';
      }

      if (shouldSendReminder) {
        console.log(`[SCHEDULER] Sending reminder for invoice ${invoice.id} - ${reminderTrigger}`);

        // Build reminder email
        const invoiceUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard/invoices/${invoice.id}`;
        const amountStr = invoice.amount ? `$${invoice.amount.toFixed(2)}` : 'Amount pending';

        const emailHtml = `
          <h2>Invoice Payment Reminder</h2>
          <p>Hi ${invoice.user.firstName},</p>
          <p>This is a reminder that your invoice is overdue.</p>
          <ul>
            <li><strong>Invoice Number:</strong> ${invoice.id}</li>
            <li><strong>Amount:</strong> ${amountStr}</li>
            <li><strong>Days Overdue:</strong> ${daysOverdue} days</li>
            <li><strong>Original Due Date:</strong> ${dueDate.toLocaleDateString()}</li>
          </ul>
          <p>Please review and pay your invoice:</p>
          <p><a href="${invoiceUrl}">${invoiceUrl}</a></p>
          <p>If you have already paid, please disregard this message.</p>
        `;

        // Send email (non-blocking)
        sendEmail({
          to: invoice.user.email,
          subject: `Invoice Payment Reminder - ${daysOverdue} Days Overdue`,
          html: emailHtml,
        }).catch((err) => {
          console.error(`[SCHEDULER] Failed to send reminder email for invoice ${invoice.id}:`, err);
        });

        // Update invoice tracking
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            reminderCount: invoice.reminderCount + 1,
            lastReminderSentAt: now,
          },
        });

        console.log(`[SCHEDULER] Invoice ${invoice.id} reminder sent, reminderCount now ${invoice.reminderCount + 1}`);
      }
    }

    console.log('[SCHEDULER] Invoice aging check complete');
  } catch (err) {
    console.error('[SCHEDULER] Invoice aging check error:', err);
    Sentry.captureException(err, {
      contexts: {
        scheduler: {
          job: 'checkInvoiceAging',
          cron: '0 8 * * *',
        },
      },
    });
  }
}

async function checkStaleOrders() {
  try {
    // Dynamically import at runtime to avoid webpack bundling issues
    const { prisma } = await import('./prisma');

    console.log('[SCHEDULER] Checking stale orders...');

    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // Find PENDING orders older than 48 hours that are not already marked stale
    const staleOrders = await prisma.order.findMany({
      where: {
        status: 'PENDING',
        updatedAt: {
          lt: fortyEightHoursAgo,
        },
        isStale: false,
      },
    });

    console.log(`[SCHEDULER] Found ${staleOrders.length} newly stale orders`);

    // Update all stale orders in batch
    if (staleOrders.length > 0) {
      const result = await prisma.order.updateMany({
        where: {
          id: {
            in: staleOrders.map((o) => o.id),
          },
        },
        data: {
          isStale: true,
          staleAt: now,
        },
      });

      console.log(`[SCHEDULER] Marked ${result.count} orders as stale`);
    }

    console.log('[SCHEDULER] Stale order check complete');
  } catch (err) {
    console.error('[SCHEDULER] Stale order check error:', err);
    Sentry.captureException(err, {
      contexts: {
        scheduler: {
          job: 'checkStaleOrders',
          cron: '0 9 * * *',
        },
      },
    });
  }
}

export async function startScheduler() {
  // Dynamically import server-only modules at runtime to avoid webpack bundling issues
  const { pollAndProcess } = await import('./emailPoller');

  // Job 1: 811 poll - every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('[SCHEDULER] 811 poll running...');
    try {
      await pollAndProcess();
    } catch (err) {
      console.error('[SCHEDULER] 811 poll error:', err);
      Sentry.captureException(err, {
        contexts: {
          scheduler: {
            job: 'pollAndProcess',
            cron: '*/5 * * * *',
          },
        },
      });
    }
  });

  // Job 2: Invoice aging reminder - daily at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    await checkInvoiceAging();
  });

  // Job 3: Stale order check - daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    await checkStaleOrders();
  });

  console.log('[SCHEDULER] All jobs initialized');
}
