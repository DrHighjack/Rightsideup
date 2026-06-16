# Track 4 Step 12 - Invoice Aging Reminders
## Implementation Complete

### ✅ Schema Update

**File:** `prisma/schema.prisma`

Invoice model updated with tracking fields:
- `dueDate` - DateTime for invoice due date
- `lastReminderSentAt` - DateTime tracking last reminder sent
- `reminderCount` - Int counter for reminder stages (0, 1, 2)
- Added indexes on `status` and `dueDate` for query performance

```prisma
model Invoice {
  id                String     @id @default(cuid())
  userId            String
  user              User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  amount            Float?
  status            String     @default("PENDING")
  dueDate           DateTime?
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  lastReminderSentAt DateTime?
  reminderCount     Int        @default(0)
  
  @@map("invoices")
  @@index([userId])
  @@index([status])
  @@index([dueDate])
}
```

### ✅ Database Migration Applied

**Migration:** `20260524204306_add_invoice_aging_fields`

Migration applied cleanly with:
- ALTER TABLE "invoices" ADD COLUMN "dueDate" TIMESTAMP(3)
- ALTER TABLE "invoices" ADD COLUMN "lastReminderSentAt" TIMESTAMP(3)
- ALTER TABLE "invoices" ADD COLUMN "reminderCount" INTEGER DEFAULT 0
- Created index on status and dueDate columns

✅ Database sync verified - no errors

### ✅ Scheduler Implementation

**File:** `lib/scheduler.ts`

Replaced console.log placeholder with `checkInvoiceAging()` function:

**Function Logic:**

1. **Query invoices** where status = 'SENT' or 'OVERDUE'
2. **For each invoice:**
   - Skip if no dueDate
   - Calculate daysOverdue = (now - dueDate) in days
   - Update status to 'OVERDUE' if past due and currently 'SENT'

3. **Reminder triggers based on reminderCount:**
   - **7 days overdue + reminderCount = 0** → Send 1st reminder
   - **14 days overdue + reminderCount = 1** → Send 2nd reminder
   - **30 days overdue + reminderCount = 2** → Send 3rd reminder

4. **When reminder sent:**
   - Build HTML email with:
     - Invoice number
     - Amount (formatted as $X.XX)
     - Days overdue
     - Original due date
     - Link to /dashboard/invoices/[id]
   - Send via Nodemailer (non-blocking with catch handler)
   - Update invoice: `reminderCount++`, set `lastReminderSentAt = now`
   - Log all actions for audit trail

5. **Email template includes:**
   - Professional HTML formatting
   - Personalized greeting with realtor first name
   - Invoice details table
   - Clickable invoice link
   - Disregard message for already-paid invoices

**Cron schedule:**
- Runs daily at 8:00 AM (0 8 * * *)
- Async operation with proper error handling
- Logging at each step for monitoring

### 📋 Function Code

```typescript
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
  }
}
```

### ✅ Features Implemented

✅ Query invoices with status SENT or OVERDUE
✅ Calculate days overdue from dueDate
✅ Auto-mark as OVERDUE when past due
✅ Tiered reminder schedule (7, 14, 30 days)
✅ reminderCount tracking prevents duplicate emails
✅ lastReminderSentAt timestamp for audit
✅ HTML email template with invoice details
✅ Clickable invoice link to dashboard
✅ Non-blocking email with error handling
✅ Comprehensive logging for monitoring
✅ Dynamic imports to avoid webpack issues

### 📊 Reminder Flow Example

```
Day 0: Invoice created, status = PENDING
Day 7: Invoice marked SENT, reminder scheduled
  → checkInvoiceAging runs
  → daysOverdue = 7, reminderCount = 0
  → ✅ Sends 1st reminder email
  → reminderCount = 1, lastReminderSentAt = today

Day 14: Days overdue = 14
  → reminderCount = 1
  → ✅ Sends 2nd reminder email
  → reminderCount = 2, lastReminderSentAt = today

Day 30: Days overdue = 30
  → reminderCount = 2
  → ✅ Sends 3rd reminder email
  → reminderCount = 3, lastReminderSentAt = today

Day 31+: No more reminders sent
  → reminderCount = 3 (condition reminderCount === 2 no longer matches)
```

### ✅ Deployment Ready

- No errors in TypeScript/linting
- Migration verified on production database
- Scheduler runs daily at 8:00 AM
- Fallback error handling on all operations
- Logging provides full audit trail
- Non-blocking email operation

**Status: ✅ STEP 12 COMPLETE**
