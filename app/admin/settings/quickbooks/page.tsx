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

interface ImportResult {
  scanned: number;
  imported: number;
  skippedDuplicates: number;
  unmatchedInvoices: number;
  unmatchedCustomers: Array<{
    customerId: string;
    customerName: string;
    email: string | null;
    invoiceCount: number;
  }>;
  conflicts: Array<{
    quickBooksId: string;
    invoiceNumber: string;
  }>;
  errors: Array<{
    quickBooksId: string;
    invoiceNumber: string | null;
    error: string;
  }>;
}

function QuickBooksSettingsContent() {
  const searchParams = useSearchParams();
  const [connection, setConnection] = useState<QBOConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
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

  async function handleImportInvoices() {
    if (!confirm(
      'Import all QuickBooks invoice history? This does not email customers or charge payment methods. Existing imported invoices will be skipped.'
    )) return;

    try {
      setImporting(true);
      setError(null);
      setSuccess(null);
      setImportResult(null);

      const response = await fetch('/api/admin/quickbooks/invoices/import', {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to import QuickBooks invoices');
      }

      setImportResult(data);
      setSuccess(`Imported ${data.imported} QuickBooks invoice${data.imported === 1 ? '' : 's'}.`);
    } catch (err) {
      console.error('QuickBooks invoice import error:', err);
      setError(err instanceof Error ? err.message : 'Failed to import QuickBooks invoices');
    } finally {
      setImporting(false);
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
                <div className="mb-4 border border-gray-200 bg-gray-50 p-4">
                  <h3 className="font-semibold text-gray-900">Historical invoice import</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Import every QuickBooks invoice whose customer email matches a realtor account.
                    Paid and outstanding history is preserved. No emails or charges are triggered.
                  </p>
                  <button
                    type="button"
                    onClick={handleImportInvoices}
                    disabled={importing}
                    className="mt-4 w-full bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {importing ? 'Importing invoice history...' : 'Import all QuickBooks invoices'}
                  </button>
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

        {importResult && (
          <div className="border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">Last import result</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div><p className="text-xs uppercase text-gray-500">Scanned</p><p className="mt-1 text-2xl font-bold text-gray-900">{importResult.scanned}</p></div>
              <div><p className="text-xs uppercase text-gray-500">Imported</p><p className="mt-1 text-2xl font-bold text-green-700">{importResult.imported}</p></div>
              <div><p className="text-xs uppercase text-gray-500">Already here</p><p className="mt-1 text-2xl font-bold text-gray-700">{importResult.skippedDuplicates}</p></div>
              <div><p className="text-xs uppercase text-gray-500">Unmatched</p><p className="mt-1 text-2xl font-bold text-amber-700">{importResult.unmatchedInvoices}</p></div>
            </div>

            {importResult.unmatchedCustomers.length > 0 && (
              <div className="mt-5 border-t border-gray-200 pt-5">
                <h3 className="font-semibold text-gray-900">Customers needing a realtor match</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Add or update the realtor with the same email, then run the import again.
                </p>
                <div className="mt-3 max-h-64 overflow-auto border border-gray-200">
                  {importResult.unmatchedCustomers.map((customer) => (
                    <div key={customer.customerId} className="flex items-center justify-between gap-4 border-b border-gray-100 p-3 last:border-b-0">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{customer.customerName}</p>
                        <p className="truncate text-sm text-gray-600">{customer.email || 'No email in QuickBooks'}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-amber-700">{customer.invoiceCount} invoices</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importResult.conflicts.length > 0 && (
              <div className="mt-5 border-t border-gray-200 pt-5">
                <h3 className="font-semibold text-gray-900">Invoice number conflicts</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {importResult.conflicts.length} QuickBooks invoice number{importResult.conflicts.length === 1 ? '' : 's'} already belong to local invoices and were skipped.
                </p>
              </div>
            )}

            {importResult.errors.length > 0 && (
              <div className="mt-5 border-t border-gray-200 pt-5">
                <h3 className="font-semibold text-red-900">Invoices that could not be imported</h3>
                <div className="mt-3 max-h-64 overflow-auto border border-red-200">
                  {importResult.errors.map((invoiceError) => (
                    <div key={invoiceError.quickBooksId} className="border-b border-red-100 p-3 last:border-b-0">
                      <p className="font-medium text-gray-900">{invoiceError.invoiceNumber || invoiceError.quickBooksId}</p>
                      <p className="mt-1 text-sm text-red-700">{invoiceError.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
