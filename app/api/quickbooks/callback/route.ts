import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exchangeCodeForToken, getCompanyInfo } from '@/lib/quickbooks';
import { encryptToken } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quickbooks/callback
 * Handles OAuth callback from QuickBooks
 */
export async function GET(req: NextRequest) {
  try {
    console.log('🔄 QB Callback invoked');
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const realmId = searchParams.get('realmId');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    console.log('📋 Params:', { code: code ? '***' : null, realmId, error, state: state ? '***' : null });

    // Check for OAuth errors
    if (error) {
      console.error('❌ QuickBooks OAuth error:', error);
      return NextResponse.redirect(
        `http://localhost:3000/admin/settings/quickbooks?error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !realmId || !state) {
      console.error('❌ Missing code, realmId, or state in callback');
      return NextResponse.redirect(
        'http://localhost:3000/admin/settings/quickbooks?error=missing_params'
      );
    }

    // Decode and verify state
    console.log('🔐 Verifying state...');
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      console.log('✅ State decoded:', { userId: stateData.userId, timestamp: stateData.timestamp });
    } catch (err) {
      console.error('❌ Invalid state:', err);
      return NextResponse.redirect(
        'http://localhost:3000/admin/settings/quickbooks?error=invalid_state'
      );
    }

    // Verify the user making the callback is an admin
    const user = await prisma.user.findUnique({
      where: { id: stateData.userId },
      select: { id: true, email: true, role: true },
    });

    console.log('👤 User lookup result:', user);

    if (!user || user.role !== 'ADMIN') {
      console.error('❌ User not found or not admin:', { userId: stateData.userId, userEmail: user?.email, role: user?.role });
      return NextResponse.redirect(
        'http://localhost:3000/admin/settings/quickbooks?error=unauthorized'
      );
    }

    console.log('✅ User verified:', { email: user.email, role: user.role });

    // Exchange code for tokens
    console.log('💱 Exchanging code for tokens...');
    let tokenData;
    try {
      tokenData = await exchangeCodeForToken(code);
      console.log('✅ Token exchange successful');
    } catch (tokenErr) {
      console.error('❌ Token exchange error:', tokenErr);
      return NextResponse.redirect(
        'http://localhost:3000/admin/settings/quickbooks?error=token_exchange_failed'
      );
    }

    // Get company name
    console.log('📊 Fetching company info...');
    let companyName = 'Connected Company';
    try {
      companyName = await getCompanyInfo(tokenData.access_token, realmId);
      console.log('✅ Company name:', companyName);
    } catch (err) {
      console.error('⚠️ Failed to fetch company name:', err);
      // Continue with generic name if this fails
    }

    // Calculate token expiry times
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    const refreshExpiresAt = new Date(
      Date.now() + (tokenData.x_refresh_token_expires_in || 8640000) * 1000
    );

    // Check if connection already exists
    const existingConnection = await prisma.qBOConnection.findUnique({
      where: { realmId },
    });

    // Encrypt tokens before storage
    const encryptedAccessToken = encryptToken(tokenData.access_token);
    const encryptedRefreshToken = encryptToken(tokenData.refresh_token);

    if (existingConnection) {
      // Update existing connection
      await prisma.qBOConnection.update({
        where: { realmId },
        data: {
          companyName,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          refreshExpiresAt,
          isConnected: true,
          connectedAt: new Date(),
          disconnectedAt: null,
        },
      });
    } else {
      // Create new connection
      await prisma.qBOConnection.create({
        data: {
          realmId,
          companyName,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          refreshExpiresAt,
          isConnected: true,
        },
      });
    }

    // Redirect to settings page with success
    return NextResponse.redirect(
      'http://localhost:3000/admin/settings/quickbooks?status=connected'
    );
  } catch (error) {
    console.error('QB Callback Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(
      `http://localhost:3000/admin/settings/quickbooks?error=${encodeURIComponent(errorMessage)}`
    );
  }
}
