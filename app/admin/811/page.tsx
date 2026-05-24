'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket811[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData>({
    active: 0,
    needsReview: 0,
    clearedThisMonth: 0,
    ordersOnHold: 0,
  });
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'NEEDS_REVIEW' | 'CLEARED'>('ALL');
  const [polling, setPolling] = useState(false);

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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">811 Ticket Management</h1>
          <div className="flex gap-4">
            <button
              onClick={handlePoll}
              disabled={polling}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {polling ? 'Polling...' : 'Manual Poll'}
            </button>
            <Link href="/admin/811/create">
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Create Ticket
              </button>
            </Link>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-red-50 rounded-lg p-6 border border-red-200">
            <div className="text-sm text-gray-600">Active Tickets</div>
            <div className="text-3xl font-bold text-red-600">{summary.active}</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
            <div className="text-sm text-gray-600">Needs Review</div>
            <div className="text-3xl font-bold text-yellow-600">{summary.needsReview}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-6 border border-green-200">
            <div className="text-sm text-gray-600">Cleared (This Month)</div>
            <div className="text-3xl font-bold text-green-600">{summary.clearedThisMonth}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <div className="text-sm text-gray-600">Orders on Hold</div>
            <div className="text-3xl font-bold text-blue-600">{summary.ordersOnHold}</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
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
                      <Link href={`/admin/811/${ticket.id}`}>
                        <span className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
                          View Details
                        </span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
