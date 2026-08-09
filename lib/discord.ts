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

function getActivityWebhookUrl() {
  return (
    process.env.DISCORD_ACTIVITY_WEBHOOK_URL ||
    process.env.DISCORD_ORDER_WEBHOOK_URL
  );
}

function formatAction(action: string) {
  return action
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function sendActivityDiscordWebhook(event: ActivityDiscordPayload) {
  const webhookUrl = getActivityWebhookUrl();
  if (!webhookUrl) {
    return;
  }

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

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      username: 'North Shore Sign Co Activity',
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: formatAction(event.action),
          description: event.description.slice(0, 4096),
          color: event.action === 'REALTOR_LOGIN' ? 0x2e7d32 : 0x0f4c5c,
          fields,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord activity webhook returned ${response.status}`);
  }
}

export async function sendNewOrderDiscordWebhook(order: NewOrderDiscordPayload) {
  const webhookUrl = process.env.DISCORD_ORDER_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[DISCORD] DISCORD_ORDER_WEBHOOK_URL is not configured; skipping new order notification.');
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.northshoresignco.com';
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      username: 'North Shore Sign Co Orders',
      allowed_mentions: { parse: [] },
      embeds: [
        {
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
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook returned ${response.status}`);
  }
}