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