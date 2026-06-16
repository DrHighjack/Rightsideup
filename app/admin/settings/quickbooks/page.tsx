'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface QBOConnection {
  id: string;
  realmId: string;
  companyName: string | null;
  isConnected: boolean;
  connectedAt: string;
}

function QuickBooksSettingsContent() {
  const searchParams = useSearchParams();
  const [connection, setConnection] = useState<QBOConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Handle OAuth callback messages
  useEffect(() => {
    const status = searchParams.get('status');
    const errorParam = searchParams.get('error');

    if (status === 'connected') {
      setSuccess('Successfully connected to QuickBooks!');
    } else if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }

    // Fetch connection status
    fetchConnectionStatus();
  }, [searchParams]);

  async function fetchConnectionStatus() {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/quickbooks/status');
      
      if (!response.ok) {
        throw new Error('Failed to fetch QuickBooks status');
      }

      const data = await response.json();
      setConnection(data.connection || null);
    } catch (err) {
      console.error('Error fetching QB status:', err);
      setError('Failed to load QuickBooks status');
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    try {
      // Redirect to connect endpoint which will handle OAuth flow
      window.location.href = '/api/quickbooks/connect';
    } catch (err) {
      console.error('Connect error:', err);
      setError('Failed to initiate QuickBooks connection');
    }
  }

  async function handleDisconnect() {
    if (!connection) return;
    if (!confirm('Are you sure you want to disconnect from QuickBooks?')) return;

    try {
      setDisconnecting(true);
      const response = await fetch('/api/admin/quickbooks/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setConnection(null);
      setSuccess('Successfully disconnected from QuickBooks');
      setError(null);
    } catch (err) {
      console.error('Disconnect error:', err);
      setError('Failed to disconnect from QuickBooks');
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Manage integrations and system configuration</p>
        </div>

        {/* QuickBooks Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">QuickBooks Online</h2>
                <p className="text-gray-600 text-sm mt-1">
                  Connect your QuickBooks account to sync invoices and automate billing
                </p>
              </div>
            </div>
          </div>

          {/* Status Section */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-5 w-5 text-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading...</span>
              </div>
            ) : connection && connection.isConnected ? (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 text-lg">✓</span>
                    <div>
                      <p className="font-medium text-green-900">Connected</p>
                      <p className="text-sm text-green-700">
                        Company: {connection.companyName || 'Unknown'}
                      </p>
                      <p className="text-sm text-green-700">
                        Connected on {new Date(connection.connectedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="w-full px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 font-medium transition"
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect from QuickBooks'}
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-600 mb-4">
                  Not connected. Click below to authorize SignPost Field to access your QuickBooks account.
                </p>
                <button
                  onClick={handleConnect}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition flex items-center justify-center gap-2"
                >
                  <span>🔗</span>
                  Connect to QuickBooks
                </button>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-4">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg mb-4">
            <p className="font-medium">Success</p>
            <p className="text-sm mt-1">{success}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QuickBooksSettings() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <span className="text-gray-600">Loading settings...</span>
        </div>
      </div>
    }>
      <QuickBooksSettingsContent />
    </Suspense>
  );
}
