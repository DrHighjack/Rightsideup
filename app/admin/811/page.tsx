'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PDFUploadModal from './components/PDFUploadModal';

interface Ticket811 {
  id: string;
  ticketNumber: string;
  sourceEmail: string;
  emailSubject: string;
  parsedAddress: string;
  status: 'NEW' | 'ACTIVE' | 'NEEDS_REVIEW' | 'CLEARED' | 'DISMISSED';
  matchedOrderIds: string[];
  createdAt: string;
  clearedAt?: string;
}

interface SummaryData {
  active: number;
  needsReview: number;
  clearedThisMonth: number;
  ordersOnHold: number;
}

export default function Ticket811ListPage() {
  const [tickets, setTickets] = useState<Ticket811[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryData>({
    active: 0,
    needsReview: 0,
    clearedThisMonth: 0,
    ordersOnHold: 0,
  });
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'NEEDS_REVIEW' | 'CLEARED'>('ALL');
  const [polling, setPolling] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Fetch tickets
  async function fetchTickets() {
    try {
      setLoading(true);
      let url = '/api/admin/811';

      if (filter !== 'ALL') {
        url += `?status=${filter}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (Array.isArray(data)) {
        setTickets(data);

        // Calculate summary
        const all = data;
        const active = all.filter((t: any) => t.status === 'ACTIVE').length;
        const needsReview = all.filter((t: any) => t.status === 'NEEDS_REVIEW').length;
        const now = new Date();
        const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
        const clearedThisMonth = all.filter(
          (t: any) => t.status === 'CLEARED' && new Date(t.clearedAt) >= monthAgo
        ).length;
        const ordersOnHold = all.reduce((sum: number, t: any) => sum + t.matchedOrderIds.length, 0);

        setSummary({
          active,
          needsReview,
          clearedThisMonth,
          ordersOnHold,
        });
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTickets();
  }, [filter]);

  async function handlePoll() {
    try {
      setPolling(true);
      const res = await fetch('/api/admin/811', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'poll' }),
      });

      if (res.ok) {
        alert('Poll cycle completed. Refreshing tickets...');
        await fetchTickets();
      }
    } catch (error) {
      console.error('Poll failed:', error);
      alert('Poll failed');
    } finally {
      setPolling(false);
    }
  }

  async function handleSendClearedEmail(ticketId: string) {
    // For demo purposes, using a hardcoded userId. In production, this should be the customer associated with the order
    const userId = ""; // This would come from the order matched to this ticket
    
    if (!userId) {
      alert("Customer information not available. Please view ticket details to send email.");
      return;
    }

    try {
      setSendingId(ticketId);
      const res = await fetch(`/api/admin/811/${ticketId}/send-cleared`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        alert("Clearance email sent successfully!");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to send email");
      }
    } catch (error) {
      alert("Failed to send email");
      console.error(error);
    } finally {
      setSendingId(null);
    }
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      NEW: 'bg-gray-100 text-gray-800',
      ACTIVE: 'bg-red-100 text-red-800',
      NEEDS_REVIEW: 'bg-yellow-100 text-yellow-800',
      CLEARED: 'bg-green-100 text-green-800',
      DISMISSED: 'bg-blue-100 text-blue-800',
    };
    return (
      <span
        className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${styles[status] || styles.NEW}`}
      >
        {status}
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-3 md:mb-8 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">811 Ticket Management</h1>
          <div className="flex w-full gap-2 md:w-auto md:gap-4">
            <button
              onClick={handlePoll}
              disabled={polling}
              className="min-h-11 flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-gray-400 md:flex-none md:px-4"
            >
              {polling ? 'Polling...' : 'Manual Poll'}
            </button>
            <button
              onClick={() => setShowPdfModal(true)}
              className="min-h-11 flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 md:flex-none md:px-4"
            >
              Create Ticket
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:mb-8 md:grid-cols-4 md:gap-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 md:p-6">
            <div className="text-xs text-gray-600 md:text-sm">Active Tickets</div>
            <div className="text-2xl font-bold text-red-600 md:text-3xl">{summary.active}</div>
          </div>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 md:p-6">
            <div className="text-xs text-gray-600 md:text-sm">Needs Review</div>
            <div className="text-2xl font-bold text-yellow-600 md:text-3xl">{summary.needsReview}</div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 md:p-6">
            <div className="text-xs text-gray-600 md:text-sm">Cleared (This Month)</div>
            <div className="text-2xl font-bold text-green-600 md:text-3xl">{summary.clearedThisMonth}</div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 md:p-6">
            <div className="text-xs text-gray-600 md:text-sm">Orders on Hold</div>
            <div className="text-2xl font-bold text-blue-600 md:text-3xl">{summary.ordersOnHold}</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-4 md:hidden">
          <label htmlFor="mobile-ticket-status" className="mb-1 block text-xs font-medium text-gray-600">Ticket status</label>
          <select
            id="mobile-ticket-status"
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
            className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base"
          >
            {(['ALL', 'ACTIVE', 'NEEDS_REVIEW', 'CLEARED'] as const).map((tab) => <option key={tab} value={tab}>{tab === 'ALL' ? 'All tickets' : tab.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div className="mb-6 hidden gap-2 border-b border-gray-200 md:flex">
          {(['ALL', 'ACTIVE', 'NEEDS_REVIEW', 'CLEARED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 font-medium ${
                filter === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Tickets Table */}
        {loading ? (
          <div className="text-center py-8 text-gray-600">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-8 text-gray-600">No tickets found</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="divide-y divide-gray-200 md:hidden">
              {tickets.map((ticket) => (
                <article key={ticket.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-gray-900">Ticket #{ticket.ticketNumber}</p>
                    {getStatusBadge(ticket.status)}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm font-medium text-gray-800">{ticket.emailSubject}</p>
                  {ticket.parsedAddress && <p className="mt-1 text-sm text-gray-600">{ticket.parsedAddress}</p>}
                  <p className="mt-2 text-xs text-gray-500">{ticket.matchedOrderIds.length} orders on hold · {new Date(ticket.createdAt).toLocaleDateString()}</p>
                  <div className="mt-3 flex gap-2">
                    {ticket.status === 'CLEARED' && (
                      <button onClick={() => handleSendClearedEmail(ticket.id)} disabled={sendingId === ticket.id} className="min-h-10 rounded-md border border-green-200 px-3 text-sm font-medium text-green-700 disabled:opacity-50">
                        {sendingId === ticket.id ? 'Sending...' : 'Email'}
                      </button>
                    )}
                    <Link href={`/admin/811/${ticket.id}`} className="inline-flex min-h-10 items-center rounded-md border border-gray-300 px-3 text-sm font-medium text-blue-700">View Details</Link>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Ticket #
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Address
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Orders On Hold
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {ticket.ticketNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate">
                      {ticket.emailSubject}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate">
                      {ticket.parsedAddress || '—'}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(ticket.status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {ticket.matchedOrderIds.length}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {ticket.status === 'CLEARED' && (
                          <button
                            onClick={() => handleSendClearedEmail(ticket.id)}
                            disabled={sendingId === ticket.id}
                            className="text-green-600 hover:text-green-900 font-medium text-sm disabled:opacity-50"
                          >
                            {sendingId === ticket.id ? "Sending..." : "Email"}
                          </button>
                        )}
                        <Link href={`/admin/811/${ticket.id}`}>
                          <span className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
                            View Details
                          </span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* PDF Upload Modal */}
        <PDFUploadModal isOpen={showPdfModal} onClose={() => setShowPdfModal(false)} />
      </div>
    </div>
  );
}
