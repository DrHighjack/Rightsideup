import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quickbooks/webhook
 * Health check for webhook endpoint
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}

/**
 * POST /api/quickbooks/webhook
 * Handles incoming QuickBooks webhooks
 * TODO: Implement full webhook processing:
 * - Verify HMAC signature using QB_WEBHOOK_VERIFIER_TOKEN
 * - Parse event payload
 * - Update local Invoice status based on QB events
 * - Handle invoice paid, voided, payment received events
 */
export async function POST(req: NextRequest) {
  try {
    console.log('🔔 QB Webhook received');
    
    // TODO: Verify HMAC signature
    // const verifierToken = process.env.QB_WEBHOOK_VERIFIER_TOKEN;
    // if (!verifierToken) {
    //   return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    // }

    // TODO: Parse webhook payload
    // const body = await req.json();
    // console.log('📋 Webhook payload:', body);

    // TODO: Process webhook events
    // - Update Invoice status in database
    // - Trigger notifications
    // - Log activity

    return NextResponse.json({ status: 'received' }, { status: 200 });
  } catch (error) {
    console.error('QB Webhook Error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}
