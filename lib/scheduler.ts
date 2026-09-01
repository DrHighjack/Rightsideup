import cron from 'node-cron';
import * as Sentry from '@sentry/nextjs';

interface NotifiableUtilityLine {
  name: string;
  status: string;
  responseEmailPendingAt?: string;
  responseEmailSentAt?: string;
  [key: string]: unknown;
}

async function sendPending811LineResponseEmails() {
  const { prisma } = await import('./prisma');
  const { get811LinesRespondedEmail, sendEmail } = await import('./email');
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);

  const tickets = await prisma.ticket811.findMany({
    where: { updatedAt: { lte: cutoff }, realtorId: { not: null } },
    include: {
      realtor: {
        select: {
          id: true,
          email: true,
          firstName: true,
          tcAgentLinks: {
            select: { tcUser: { select: { email: true, firstName: true } } },
          },
        },
      },
      order: { select: { address: true } },
    },
  });

  for (const ticket of tickets) {
    const utilityLines = Array.isArray(ticket.utilityLines)
      ? (ticket.utilityLines as unknown as NotifiableUtilityLine[])
      : [];
    const pendingLines = utilityLines.filter((line) => {
      if (!line.responseEmailPendingAt || line.responseEmailSentAt) return false;
      return new Date(line.responseEmailPendingAt) <= cutoff;
    });

    if (pendingLines.length === 0 || !ticket.realtor) continue;

    const recipients = new Map<string, string>();
    recipients.set(ticket.realtor.email, ticket.realtor.firstName || 'there');
    ticket.realtor.tcAgentLinks.forEach((link) => {
      recipients.set(link.tcUser.email, link.tcUser.firstName || 'there');
    });

    const ticketLink = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.northshoresignco.com'}/dashboard/811`;
    await Promise.all(Array.from(recipients.entries()).map(async ([email, firstName]) => {
      try {
        const message = get811LinesRespondedEmail(
          firstName,
          ticket.ticketNumber || 'Pending',
          ticket.order?.address || ticket.parsedAddress || 'Listing address unavailable',
          pendingLines.map((line) => ({ name: line.name, status: line.status })),
          ticketLink
        );
        await sendEmail({ to: email, subject: message.subject, html: message.html });
      } catch (emailError) {
        console.error(`Failed to send 811 line update email to ${email}:`, emailError);
      }
    }));

    const sentAt = new Date().toISOString();
    const pendingNames = new Set(pendingLines.map((line) => line.name));
    await prisma.ticket811.update({
      where: { id: ticket.id },
      data: {
        utilityLines: utilityLines.map((line) =>
          pendingNames.has(line.name)
            ? { ...line, responseEmailSentAt: sentAt }
            : line
        ) as any,
      },
    });
  }
}

async function checkInvoiceAging() {
  try {
    // Dynamically import at runtime to avoid webpack bundling issues
    const { prisma } = await import('./prisma');
    const { getInvoiceReminderEmail, sendEmail } = await import('./email');

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

        const invoiceUrl = `${process.env.NEXTAUTH_URL || 'https://app.northshoresignco.com'}/dashboard/invoices/${invoice.id}`;
        const amountStr = invoice.amount ? `$${(invoice.amount / 100).toFixed(2)}` : 'Amount pending';
        const reminderEmail = getInvoiceReminderEmail(
          invoice.user.firstName || 'there',
          invoice.id,
          dueDate.toLocaleDateString(),
          daysOverdue,
          amountStr,
          invoiceUrl,
          invoice.reminderCount || 0
        );

        // Send email (non-blocking)
        sendEmail({
          to: invoice.user.email,
          subject: reminderEmail.subject,
          html: reminderEmail.html,
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

  cron.schedule('* * * * *', async () => {
    try {
      await sendPending811LineResponseEmails();
    } catch (err) {
      console.error('[SCHEDULER] 811 line response email error:', err);
      Sentry.captureException(err);
    }
  });

  // Job 2: Invoice aging reminder - daily at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    await checkInvoiceAging();
  });

  console.log('[SCHEDULER] All jobs initialized');
}
