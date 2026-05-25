import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quickbooks/connect
 * Initiates OAuth flow with QuickBooks
 * User must be logged in as admin
 */
export async function GET(_req: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    // Build OAuth authorization URL
    const clientId = process.env.QB_CLIENT_ID;
    const redirectUri = process.env.QB_REDIRECT_URI;
    const scope = 'com.intuit.quickbooks.accounting';
    
    // Encode user ID and timestamp in state
    const state = Buffer.from(JSON.stringify({
      userId: session.user?.id,
      timestamp: Date.now(),
    })).toString('base64');

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: 'QuickBooks configuration missing. Check QB_CLIENT_ID and QB_REDIRECT_URI.' },
        { status: 500 }
      );
    }

    const authUrl = new URL('https://appcenter.intuit.com/connect/oauth2');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scope);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', state);

    // Redirect to QuickBooks OAuth page
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('QB Connect Error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate QuickBooks connection' },
      { status: 500 }
    );
  }
}
