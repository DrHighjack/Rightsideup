import { ImapFlow } from 'imapflow';
import { PrismaClient } from '@prisma/client';
import {
  get811NeedsReviewAlertEmail,
  get811TicketCreatedAlertEmail,
  sendEmail,
} from './email';

interface RawEmail {
  subject: string;
  from: string;
  body: string;
  date: Date;
  uid: number;
}

interface ParsedAddress {
  address: string | null;
  ticketNumber: string | null;
  workStartDate: string | null;
  confidence: 'high' | 'low';
}

/**
 * Parse address, ticket number, and work start date from 811 email body
 * Handles multiple label variations commonly found in 811 emails
 * Returns: { address, ticketNumber, workStartDate, confidence }
 * Confidence: 'high' if found with known label prefix, 'low' if fallback pattern or not found
 */
export function parseAddress(emailBody: string): ParsedAddress {
  let address: string | null = null;
  let ticketNumber: string | null = null;
  let workStartDate: string | null = null;
  let addressConfidence: 'high' | 'low' = 'low';

  // Extract address with multiple label variations
  const addressLabels = [
    'Excavation Address:',
    'Work Location:',
    'Site Address:',
    'Dig Site:',
    'Location:',
    'Address of Work:',
  ];

  for (const label of addressLabels) {
    const regex = new RegExp(`${label}\\s*([^\\n]+)`, 'i');
    const match = emailBody.match(regex);
    if (match && match[1]) {
      address = match[1].trim();
      addressConfidence = 'high';
      break;
    }
  }

  // Fallback: try to find any line that looks like an address (contains numbers and common address patterns)
  if (!address) {
    const lines = emailBody.split('\n');
    for (const line of lines) {
      // Look for lines with street number, street name, city, state, zip
      if (/\d+\s+[A-Z].*(?:St|Ave|Blvd|Rd|Drive|Lane|Court|Way|Road|Street|Avenue|Boulevard),?\s+[A-Z][a-z]+,?\s+[A-Z]{2}\s+\d{5}/.test(line)) {
        address = line.trim();
        addressConfidence = 'low';
        break;
      }
    }
  }

  // Extract ticket number with multiple label variations
  const ticketLabels = [
    'Ticket Number:',
    'Ticket #:',
    'Locate Request #:',
    'Request #:',
    'Ticket:',
  ];

  for (const label of ticketLabels) {
    const regex = new RegExp(`${label}\\s*([^\\n]+)`, 'i');
    const match = emailBody.match(regex);
    if (match && match[1]) {
      ticketNumber = match[1].trim();
      break;
    }
  }

  // Fallback: look for pattern like YYYY-MM-DD-XXXXXX or similar ticket patterns
  if (!ticketNumber) {
    const ticketPatternMatch = emailBody.match(/(\d{4}-\d{2}-\d{2}-\d+|\d{10,})/);
    if (ticketPatternMatch) {
      ticketNumber = ticketPatternMatch[1];
    }
  }

  // Extract work start date with multiple label variations
  const dateLabels = [
    'Work Start Date:',
    'Start Date:',
    'Scheduled Date:',
    'Work Date:',
    'Date:',
  ];

  for (const label of dateLabels) {
    const regex = new RegExp(`${label}\\s*([^\\n]+)`, 'i');
    const match = emailBody.match(regex);
    if (match && match[1]) {
      workStartDate = match[1].trim();
      break;
    }
  }

  // Fallback: look for date patterns (MM/DD/YYYY or YYYY-MM-DD)
  if (!workStartDate) {
    const datePatternMatch = emailBody.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
    if (datePatternMatch) {
      workStartDate = datePatternMatch[1];
    }
  }

  // Overall confidence: high if address was found with high confidence, low otherwise
  const confidence = addressConfidence === 'high' ? 'high' : 'low';

  return {
    address,
    ticketNumber,
    workStartDate,
    confidence,
  };
}

/**
 * Connect to IMAP inbox and fetch unread emails matching 811 keywords
 * Keywords: '811', 'Dig Safe', 'One Call', 'utility locate', 'ticket'
 * Marks fetched emails as read on the server
 * Returns: Array of { subject, from, body, date, uid }
 */
export async function connectAndFetch(): Promise<RawEmail[]> {
  // Dynamically import prisma and encryption to avoid webpack bundling issues
  const { prisma } = await import('./prisma');
  const { decryptToken } = await import('./encryption');

  // Try to fetch IMAP credentials from database first, fall back to env vars
  let imapHost = process.env.IMAP_HOST;
  let imapPort = process.env.IMAP_PORT;
  let imapUser = process.env.IMAP_USER;
  let imapPassword = process.env.IMAP_PASSWORD;

  try {
    // Check if settings are configured in database
    const dbSettings = await prisma.appSettings.findMany({
      where: {
        key: {
          in: ['imap.imapHost', 'imap.imapPort', 'imap.imapEmail', 'imap.imapPassword'],
        },
      },
    });

    if (dbSettings.length > 0) {
      for (const setting of dbSettings) {
        let value = setting.value;

        // Decrypt if encrypted
        if (setting.isEncrypted) {
          try {
            value = decryptToken(setting.value);
          } catch (err) {
            console.error(`[EMAILPOLLER] Failed to decrypt ${setting.key}`);
            continue;
          }
        }

        if (setting.key === 'imap.imapHost' && value) imapHost = value;
        if (setting.key === 'imap.imapPort' && value) imapPort = value;
        if (setting.key === 'imap.imapEmail' && value) imapUser = value;
        if (setting.key === 'imap.imapPassword' && value) imapPassword = value;
      }
    }
  } catch (err) {
    console.warn('[EMAILPOLLER] Could not fetch IMAP settings from database, using environment variables');
  }

  if (!imapHost || !imapPort || !imapUser || !imapPassword) {
    throw new Error(
      'Missing IMAP configuration. Set via /admin/settings or configure: IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASSWORD'
    );
  }

  // Initialize IMAP connection (Gmail requires app password)
  const client = new ImapFlow({
    host: imapHost,
    port: parseInt(imapPort, 10),
    secure: true, // TLS connection
    auth: {
      user: imapUser,
      pass: imapPassword,
    },
  } as any);

  try {
    // Connect to server
    await client.connect();
    console.log('[EMAILPOLLER] Connected to IMAP inbox');

    // Open INBOX mailbox
    const mailbox = await client.mailboxOpen('INBOX');
    console.log(`[EMAILPOLLER] INBOX opened. Total messages: ${mailbox.exists}`);

    // Search for unseen emails
    const unseenUIDs = await client.search({
      unseen: true,
    } as any);
    if (!Array.isArray(unseenUIDs)) {
      console.log('[EMAILPOLLER] No unseen emails to process');
      return [];
    }
    console.log(`[EMAILPOLLER] Found ${unseenUIDs.length} unseen emails`);

    if (unseenUIDs.length === 0) {
      console.log('[EMAILPOLLER] No unseen emails to process');
      return [];
    }

    const keywords = ['811', 'Dig Safe', 'One Call', 'utility locate', 'ticket'];
    const emails: RawEmail[] = [];

    // Fetch email envelope (headers only, no body)
    for await (const message of client.fetch(unseenUIDs, { envelope: true })) {
      const subject = message.envelope?.subject || '(no subject)';
      const from = message.envelope?.from?.[0]?.address || '(unknown)';
      const date = message.envelope?.date || new Date();
      const uid = message.uid as number;

      // Check if subject contains any keyword
      const hasKeyword = keywords.some((kw) => subject.toLowerCase().includes(kw.toLowerCase()));

      if (hasKeyword) {
        // Fetch full email body/text
        let body = '';
        try {
          // Try to get plain text first
          const textData = await client.download(uid, 'BODY[TEXT]');
          if (textData) {
            body = textData.toString();
          }
        } catch (err) {
          console.log(`[EMAILPOLLER]   (Could not fetch body: ${(err as any).message})`);
        }

        emails.push({ subject, from, body, date, uid });
        console.log(`[EMAILPOLLER] ✓ Matched: "${subject}" from ${from}`);

        // Mark email as read (non-blocking, ignore errors)
        client.messageFlagsAdd(uid, ['\\Seen']).catch((err) => {
          console.log(`[EMAILPOLLER]   (Could not mark as read: ${(err as any).message})`);
        });
      }
    }

    console.log(`[EMAILPOLLER] Successfully found ${emails.length} matching 811 emails`);
    return emails;
  } finally {
    // Close mailbox and disconnect
    try {
      await client.mailboxClose();
    } catch (err) {
      // Ignore close errors
    }
    await client.logout();
    console.log('[EMAILPOLLER] Disconnected from IMAP inbox');
  }
}

/**
 * Extract first word of street name for fuzzy matching
 * Examples: "3349 Willow Canyon St" -> "Willow", "456 Oak Ridge Road" -> "Oak"
 */
function extractStreetName(address: string): string | null {
  // Match pattern: number + street name
  const match = address.match(/^\d+\s+([A-Za-z]+)/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Fuzzy match order address with parsed 811 address
 * Compares first word of street name (ignores St/Street/Ave/Avenue differences)
 */
function fuzzyMatchAddress(orderAddress: string, parsedAddress: string): boolean {
  const orderStreet = extractStreetName(orderAddress);
  const parsed811Street = extractStreetName(parsedAddress);

  if (!orderStreet || !parsed811Street) {
    return false;
  }

  // Exact match on first word of street name
  return orderStreet === parsed811Street;
}

/**
 * Full poll and process cycle: fetch 811 emails, parse, create tickets, match orders, send alerts
 * Called by scheduler every 5 minutes
 */
export async function pollAndProcess(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    console.log('[811POLL] Starting poll cycle...');

    // Step 1: Fetch unread 811 emails
    const emails = await connectAndFetch();
    console.log(`[811POLL] Fetched ${emails.length} emails`);

    if (emails.length === 0) {
      console.log('[811POLL] No emails to process');
      return;
    }

    // Step 2: Process each email
    for (const email of emails) {
      try {
        const parsed = parseAddress(email.body);
        console.log(`[811POLL] Processing: "${email.subject}" (confidence: ${parsed.confidence})`);

        // Step 3: Handle low confidence or missing address
        if (parsed.confidence === 'low' || !parsed.address) {
          console.log('[811POLL] Low confidence - creating NEEDS_REVIEW ticket');

          const ticket = await prisma.ticket811.create({
            data: {
              ticketNumber: parsed.ticketNumber,
              sourceEmail: email.from,
              emailSubject: email.subject,
              emailBody: email.body,
              parsedAddress: parsed.address,
              workStartDate: parsed.workStartDate ? new Date(parsed.workStartDate) : null,
              status: 'NEEDS_REVIEW',
              matchedOrderIds: [],
              adminNotes: `Auto-flagged for review: low confidence address extraction`,
            },
          });

          // Send alert for NEEDS_REVIEW ticket
          const adminEmail = process.env.ADMIN_ALERT_EMAIL || 'admin@signpost.local';
          const needsReviewEmail = get811NeedsReviewAlertEmail(
            parsed.ticketNumber || '(not extracted)',
            email.from,
            email.subject,
            parsed.address || '(not found)',
            `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin/811/${ticket.id}`
          );

          await sendEmail({
            to: adminEmail,
            subject: needsReviewEmail.subject,
            html: needsReviewEmail.html,
          });

          continue;
        }

        // Step 4: High confidence - fuzzy match orders
        console.log(`[811POLL] High confidence - matching against PENDING/SCHEDULED orders`);

        const orders = await prisma.order.findMany({
          where: {
            status: {
              in: ['PENDING', 'SCHEDULED'],
            },
          },
          select: {
            id: true,
            orderNumber: true,
            address: true,
          },
        });

        const matchedOrderIds: string[] = [];

        // Match orders by fuzzy address matching
        for (const order of orders) {
          if (fuzzyMatchAddress(order.address, parsed.address)) {
            console.log(`[811POLL] ✓ Matched order: ${order.orderNumber}`);

            // Update order to ON_HOLD
            await prisma.order.update({
              where: { id: order.id },
              data: {
                status: 'ON_HOLD',
                holdReason: `811 ticket ${parsed.ticketNumber || 'unknown'}`,
                heldAt: new Date(),
              },
            });

            matchedOrderIds.push(order.id);
          }
        }

        // Step 5: Create Ticket811 record
        const ticketStatus = matchedOrderIds.length > 0 ? 'ACTIVE' : 'NEEDS_REVIEW';
        const ticket = await prisma.ticket811.create({
          data: {
            ticketNumber: parsed.ticketNumber,
            sourceEmail: email.from,
            emailSubject: email.subject,
            emailBody: email.body,
            parsedAddress: parsed.address,
            workStartDate: parsed.workStartDate ? new Date(parsed.workStartDate) : null,
            status: ticketStatus,
            matchedOrderIds: matchedOrderIds,
            adminNotes: `Auto-matched ${matchedOrderIds.length} orders`,
          },
        });

        // Step 6: Send admin alert
        const adminEmail = process.env.ADMIN_ALERT_EMAIL || 'admin@signpost.local';
        const createdEmail = get811TicketCreatedAlertEmail(
          parsed.ticketNumber || '(not extracted)',
          parsed.address || '(not found)',
          parsed.workStartDate || '(not extracted)',
          email.from,
          ticketStatus,
          orders
            .filter((o) => matchedOrderIds.includes(o.id))
            .map((o) => ({ orderNumber: o.orderNumber, address: o.address })),
          `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin/811/${ticket.id}`
        );

        await sendEmail({
          to: adminEmail,
          subject: createdEmail.subject,
          html: createdEmail.html,
        });

        console.log(`[811POLL] ✓ Created ticket ${ticket.id} (${ticketStatus})`);
      } catch (err) {
        console.error('[811POLL] Error processing email:', err);
      }
    }

    console.log('[811POLL] Poll cycle complete');
  } finally {
    await prisma.$disconnect();
  }
}
