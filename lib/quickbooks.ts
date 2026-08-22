/**
 * QuickBooks OAuth utility
 * Handles token exchange and API communication
 */

import { prisma } from '@/lib/prisma';
import { decryptToken, encryptToken } from '@/lib/encryption';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: string;
  realmId?: string;
}

export interface QuickBooksConnectionContext {
  connectionId: string;
  accessToken: string;
  realmId: string;
}

const getQuickBooksApiBaseUrl = () =>
  process.env.QB_ENVIRONMENT === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';

  const QUICKBOOKS_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const clientId = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;
  const redirectUri = process.env.QB_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('QuickBooks OAuth configuration missing');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
  }).toString();

  const response = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: body,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Token exchange failed:', {
      status: response.status,
      statusText: response.statusText,
      body: error,
      clientId: clientId ? clientId.substring(0, 10) + '...' : 'undefined',
      redirectUri: redirectUri,
    });
    throw new Error(`Failed to exchange code for token: ${response.statusText} - ${error}`);
  }

  const data = await response.json();
  return data as TokenResponse;
}

/**
 * Refresh an access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const clientId = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('QuickBooks OAuth configuration missing');
  }

  const response = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Token refresh failed:', error);
    throw new Error(`Failed to refresh token: ${response.statusText}`);
  }

  const data = await response.json();
  return data as TokenResponse;
}

/**
 * Get company info from QuickBooks
 */
export async function getCompanyInfo(accessToken: string, realmId: string): Promise<string> {
  const response = await fetch(
    `${getQuickBooksApiBaseUrl()}/v3/company/${realmId}/query?query=${encodeURIComponent('select * from CompanyInfo')}&minorversion=75`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    console.error('Failed to get company info:', await response.text());
    return 'Unknown Company';
  }

  const data = await response.json() as { QueryResponse: { CompanyInfo: Array<{ CompanyName: string }> } };
  const companyName = data.QueryResponse?.CompanyInfo?.[0]?.CompanyName;
  return companyName || 'Unknown Company';
}

export async function getActiveQuickBooksConnection(): Promise<QuickBooksConnectionContext> {
  const connection = await prisma.qBOConnection.findFirst({
    where: { isConnected: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (!connection) {
    throw new Error('QuickBooks is not connected');
  }

  if (connection.expiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
    return {
      connectionId: connection.id,
      accessToken: decryptToken(connection.accessToken),
      realmId: connection.realmId,
    };
  }

  if (connection.refreshExpiresAt && connection.refreshExpiresAt.getTime() <= Date.now()) {
    throw new Error('QuickBooks authorization has expired. Reconnect QuickBooks and try again.');
  }

  const refreshed = await refreshAccessToken(decryptToken(connection.refreshToken));
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  const refreshExpiresAt = refreshed.x_refresh_token_expires_in
    ? new Date(Date.now() + refreshed.x_refresh_token_expires_in * 1000)
    : connection.refreshExpiresAt;

  await prisma.qBOConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: encryptToken(refreshed.access_token),
      refreshToken: encryptToken(refreshed.refresh_token),
      expiresAt,
      refreshExpiresAt,
    },
  });

  return {
    connectionId: connection.id,
    accessToken: refreshed.access_token,
    realmId: connection.realmId,
  };
}

export async function queryAllQuickBooksEntities<T>(
  connection: QuickBooksConnectionContext,
  entity: 'Customer' | 'Invoice'
): Promise<T[]> {
  const pageSize = 1000;
  let startPosition = 1;
  const entities: T[] = [];

  while (true) {
    const activeClause = entity === 'Customer' ? ' where Active in (true, false)' : '';
    const query = `select * from ${entity}${activeClause} startposition ${startPosition} maxresults ${pageSize}`;
    const url = new URL(
      `${getQuickBooksApiBaseUrl()}/v3/company/${connection.realmId}/query`
    );
    url.searchParams.set('query', query);
    url.searchParams.set('minorversion', '75');

    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      });
      if (response.status !== 429) break;

      const retryAfterSeconds = Math.min(
        30,
        Math.max(1, Number(response.headers.get('Retry-After')) || 2 ** attempt)
      );
      await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
    }

    if (!response?.ok) {
      if (!response) throw new Error('QuickBooks did not return a response');
      const message = await response.text();
      console.error(`QuickBooks ${entity} query failed`, response.status, message);
      throw new Error(`QuickBooks rejected the ${entity.toLowerCase()} request (${response.status})`);
    }

    const data = await response.json() as {
      QueryResponse?: Record<string, T[] | number | undefined>;
    };
    const page = (data.QueryResponse?.[entity] as T[] | undefined) || [];
    entities.push(...page);

    if (page.length < pageSize) {
      return entities;
    }
    startPosition += page.length;
  }
}
