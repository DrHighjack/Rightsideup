import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { webhookUrl } = await request.json();

    if (!webhookUrl) {
      return NextResponse.json(
        { success: false, message: 'A webhook URL is required' },
        { status: 400 }
      );
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        username: 'North Shore Sign Co',
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: 'Test Notification',
            description: 'This is a test message from Admin Settings. If you can see this, the webhook is configured correctly.',
            color: 0x0f4c5c,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: `Discord returned status ${response.status}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'Test notification sent' });
  } catch (error) {
    console.error('Test Discord webhook error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send test notification',
      },
      { status: 400 }
    );
  }
}
