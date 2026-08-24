import { prisma } from '@/lib/prisma';
import { decryptToken } from '@/lib/encryption';
import { DiscordNotificationCategory } from '@/lib/discord-categories';

interface NewOrderDiscordPayload {
  orderId: string;
  orderNumber: string;
  type: string;
  address: string;
  realtorName: string;
  realtorEmail: string;
  scheduledDate?: Date | string | null;
  placedByRole?: string;
}

interface ActivityDiscordPayload {
  action: string;
  description: string;
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  entityType?: string;
  entityId?: string;
}

async function getAppSetting(key: string): Promise<string | null> {
  try {
    const setting = await prisma.appSettings.findUnique({ where: { key } });
    if (!setting) return null;
    return setting.isEncrypted ? decryptToken(setting.value) : setting.value;
  } catch (error) {
    console.error(`[DISCORD] Failed to read setting ${key}:`, error);
    return null;
  }
}

async function getConfiguredWebhookUrl(): Promise<string | null> {
  const dbUrl = await getAppSetting('discord.webhookUrl');
  return dbUrl || process.env.DISCORD_ORDER_WEBHOOK_URL || process.env.DISCORD_ACTIVITY_WEBHOOK_URL || null;
}

export async function isDiscordNotificationEnabled(category: DiscordNotificationCategory): Promise<boolean> {
  const value = await getAppSetting(`discord.notify.${category}`);
  // Default to enabled unless an admin has explicitly turned the category off.
  return value !== 'false';
}

async function postDiscordEmbed(
  category: DiscordNotificationCategory,
  username: string,
  embed: Record<string, unknown>
) {
  const [webhookUrl, enabled] = await Promise.all([
    getConfiguredWebhookUrl(),
    isDiscordNotificationEnabled(category),
  ]);
  if (!webhookUrl || !enabled) return;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      username,
      allowed_mentions: { parse: [] },
      embeds: [{ timestamp: new Date().toISOString(), ...embed }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook returned ${response.status}`);
  }
}

function formatAction(action: string) {
  return action
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function sendActivityDiscordWebhook(event: ActivityDiscordPayload) {
  const actor = event.actorName || event.actorEmail || 'System';
  const fields = [
    {
      name: 'User',
      value: event.actorEmail ? `${actor}\n${event.actorEmail}` : actor,
      inline: true,
    },
    ...(event.actorRole
      ? [{ name: 'Role', value: event.actorRole, inline: true }]
      : []),
    ...(event.entityType
      ? [{
          name: 'Record',
          value: `${event.entityType}${event.entityId ? ` (${event.entityId})` : ''}`,
          inline: true,
        }]
      : []),
  ];

  await postDiscordEmbed('activityLog', 'North Shore Sign Co Activity', {
    title: formatAction(event.action),
    description: event.description.slice(0, 4096),
    color: event.action === 'REALTOR_LOGIN' ? 0x2e7d32 : 0x0f4c5c,
    fields,
  });
}

export async function sendNewOrderDiscordWebhook(order: NewOrderDiscordPayload) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.northshoresignco.com';
  await postDiscordEmbed('newOrders', 'North Shore Sign Co Orders', {
    title: `New Listing Order ${order.orderNumber}`,
    url: `${appUrl}/admin/orders/${order.orderId}`,
    color: 0x0f4c5c,
    fields: [
      { name: 'Realtor', value: `${order.realtorName}\n${order.realtorEmail}`, inline: true },
      { name: 'Order Type', value: order.type, inline: true },
      { name: 'Placed By', value: order.placedByRole || 'Unknown', inline: true },
      { name: 'Listing Address', value: order.address },
      {
        name: 'Scheduled Date',
        value: order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString('en-US') : 'Not scheduled',
        inline: true,
      },
    ],
  });
}

export async function sendJobCompletedDiscordWebhook(payload: {
  orderId: string;
  orderNumber: string;
  orderType: string;
  address: string;
  realtorName: string;
  fieldTechName: string;
  techNotes?: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.northshoresignco.com';
  await postDiscordEmbed('jobCompleted', 'North Shore Sign Co Field', {
    title: `Job Completed: ${payload.orderNumber}`,
    url: `${appUrl}/admin/orders/${payload.orderId}`,
    color: 0x10b981,
    fields: [
      { name: 'Order Type', value: payload.orderType, inline: true },
      { name: 'Field Tech', value: payload.fieldTechName, inline: true },
      { name: 'Realtor', value: payload.realtorName, inline: true },
      { name: 'Address', value: payload.address },
      ...(payload.techNotes ? [{ name: 'Tech Notes', value: payload.techNotes.slice(0, 1024) }] : []),
    ],
  });
}

export async function sendInvoicePaidDiscordWebhook(payload: {
  invoiceId: string;
  invoiceNumber: string;
  amountCents: number;
  payerName: string;
  payerType: string;
  url?: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.northshoresignco.com';
  await postDiscordEmbed('invoicePaid', 'North Shore Sign Co Billing', {
    title: `Invoice Paid: ${payload.invoiceNumber}`,
    url: payload.url ?? `${appUrl}/admin/invoices/${payload.invoiceId}`,
    color: 0x10b981,
    fields: [
      { name: 'Amount', value: `$${(payload.amountCents / 100).toFixed(2)}`, inline: true },
      { name: 'Paid By', value: payload.payerName, inline: true },
      { name: 'Payer Type', value: payload.payerType, inline: true },
    ],
  });
}

export async function send811AlertDiscordWebhook(payload: {
  title: string;
  ticketNumber: string;
  address: string;
  detail?: string;
  color?: number;
}) {
  await postDiscordEmbed('ticket811', 'North Shore Sign Co 811', {
    title: payload.title,
    color: payload.color ?? 0xf59e0b,
    fields: [
      { name: 'Ticket', value: payload.ticketNumber, inline: true },
      { name: 'Address', value: payload.address },
      ...(payload.detail ? [{ name: 'Detail', value: payload.detail.slice(0, 1024) }] : []),
    ],
  });
}

export async function sendLowInventoryDiscordWebhook(payload: {
  signType: string;
  availableQuantity: number;
  threshold: number;
}) {
  await postDiscordEmbed('lowInventory', 'North Shore Sign Co Inventory', {
    title: `Low Inventory: ${payload.signType}`,
    color: 0xef4444,
    fields: [
      { name: 'Available', value: String(payload.availableQuantity), inline: true },
      { name: 'Threshold', value: String(payload.threshold), inline: true },
    ],
  });
}

export async function sendSignReportDiscordWebhook(payload: {
  signId: string;
  signNumber: string;
  reportType: string;
  realtorName: string;
  description?: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.northshoresignco.com';
  await postDiscordEmbed('signReports', 'North Shore Sign Co Signs', {
    title: `Sign Report: ${payload.signNumber}`,
    url: `${appUrl}/admin/signs/${payload.signId}`,
    color: 0xf59e0b,
    fields: [
      { name: 'Type', value: payload.reportType, inline: true },
      { name: 'Reported By', value: payload.realtorName, inline: true },
      ...(payload.description ? [{ name: 'Description', value: payload.description.slice(0, 1024) }] : []),
    ],
  });
}

export async function sendReorderRequestDiscordWebhook(payload: {
  realtorName: string;
  items: string;
}) {
  await postDiscordEmbed('reorderRequests', 'North Shore Sign Co Inventory', {
    title: 'Reorder Request',
    color: 0x3b82f6,
    fields: [
      { name: 'Requested By', value: payload.realtorName, inline: true },
      { name: 'Items', value: payload.items.slice(0, 1024) },
    ],
  });
}

export async function sendFieldIssueDiscordWebhook(payload: {
  orderId: string;
  orderNumber: string;
  fieldTechName: string;
  issueDescription: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.northshoresignco.com';
  await postDiscordEmbed('fieldIssues', 'North Shore Sign Co Field', {
    title: `Job Issue: ${payload.orderNumber}`,
    url: `${appUrl}/admin/orders/${payload.orderId}`,
    color: 0xef4444,
    fields: [
      { name: 'Field Tech', value: payload.fieldTechName, inline: true },
      { name: 'Issue', value: payload.issueDescription.slice(0, 1024) },
    ],
  });
}

export async function sendAppCrashDiscordWebhook(payload: {
  message: string;
  stack?: string;
  route?: string;
}) {
  await postDiscordEmbed('appCrashes', 'North Shore Sign Co Errors', {
    title: 'Application Error',
    color: 0xef4444,
    fields: [
      ...(payload.route ? [{ name: 'Route', value: payload.route, inline: true }] : []),
      { name: 'Message', value: payload.message.slice(0, 1024) },
      ...(payload.stack ? [{ name: 'Stack', value: `\`\`\`${payload.stack.slice(0, 900)}\`\`\`` }] : []),
    ],
  });
}
