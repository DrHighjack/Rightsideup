/**
 * QuickBooks OAuth utility
 * Handles token exchange and API communication
 */

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: string;
  realmId: string;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const clientId = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;
  const redirectUri = process.env.QB_REDIRECT_URI;

  console.log('🔍 QB Credentials loaded:', {
    clientId: clientId ? clientId.substring(0, 10) + '...' + clientId.slice(-10) : 'undefined',
    clientSecret: clientSecret ? clientSecret.substring(0, 5) + '...' + clientSecret.slice(-5) : 'undefined',
    redirectUri: redirectUri,
  });

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('QuickBooks OAuth configuration missing');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  }).toString();

  console.log('📤 Token exchange request:', {
    url: 'https://quickbooks.api.intuit.com/oauth2/tokens',
    body: body,
  });

  const response = await fetch('https://quickbooks.api.intuit.com/oauth2/tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
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

  const response = await fetch('https://quickbooks.api.intuit.com/oauth2/tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
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
    `https://quickbooks.api.intuit.com/v2/company/${realmId}/query?query=select * from CompanyInfo`,
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
