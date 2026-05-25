'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Order {
  id: string;
  orderNumber: string;
  address: string;
  status: string;
  realtorEmail: string;
}

interface Ticket811 {
  id: string;
  ticketNumber: string;
  sourceEmail: string;
  emailSubject: string;
  emailBody: string;
  parsedAddress: string;
  workStartDate?: string;
  status: 'NEW' | 'ACTIVE' | 'NEEDS_REVIEW' | 'CLEARED' | 'DISMISSED';
  matchedOrderIds: string[];
  adminNotes?: string;
  clearedAt?: string;
  createdAt: string;
  updatedAt: string;
  matchedOrders?: Order[];
  clearedByUser?: {
    id: string;
    email: string;
    name: string;
  };
}

export default function Ticket811DetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [ticket, setTicket] = useState<Ticket811 | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Form state for editing
  const [formData, setFormData] = useState({
    parsedAddress: '',
    adminNotes: '',
  });

  // Fetch ticket
  useEffect(() => {
    async function fetchTicket() {
      try {
        const res = await fetch(`/api/admin/811/${id}`);
        if (res.ok) {
          const data = await res.json();
          setTicket(data);
          setFormData({
            parsedAddress: data.parsedAddress || '',
            adminNotes: data.adminNotes || '',
          });
        }
      } catch (error) {
        console.error('Failed to fetch ticket:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchTicket();
  }, [id]);

  async function handleClear() {
    try {
      setProcessing(true);
      const res = await fetch(`/api/admin/811/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clear',
          adminNotes: formData.adminNotes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        setTicket(data.ticket);
        setEditing(false);
      }
    } catch (error) {
      console.error('Failed to clear ticket:', error);
      alert('Failed to clear ticket');
    } finally {
      setProcessing(false);
    }
  }

  async function handleDismiss() {
    try {
      setProcessing(true);
      const res = await fetch(`/api/admin/811/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'dismiss',
          adminNotes: formData.adminNotes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        setTicket(data.ticket);
        setEditing(false);
      }
    } catch (error) {
      console.error('Failed to dismiss ticket:', error);
      alert('Failed to dismiss ticket');
    } finally {
      setProcessing(false);
    }
  }

  async function handleUpdate() {
    try {
      setProcessing(true);
      const res = await fetch(`/api/admin/811/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          parsedAddress: formData.parsedAddress,
          adminNotes: formData.adminNotes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTicket(data);
        setEditing(false);
        alert('Ticket updated');
      }
    } catch (error) {
      console.error('Failed to update ticket:', error);
      alert('Failed to update ticket');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Loading ticket...</div>;
  }

  if (!ticket) {
    return <div className="p-8 text-center text-red-600">Ticket not found</div>;
  }

  const getStatusBadge = (status: string) => {
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
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <Link href="/admin/811" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
              ← Back to Tickets
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Ticket #{ticket.ticketNumber}</h1>
          </div>
          <div>{getStatusBadge(ticket.status)}</div>
        </div>

        {/* Ticket Details */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <div className="text-sm text-gray-600">From</div>
              <div className="text-lg font-medium text-gray-900">{ticket.sourceEmail}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Created</div>
              <div className="text-lg font-medium text-gray-900">
                {new Date(ticket.createdAt).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Subject</div>
              <div className="text-lg font-medium text-gray-900">{ticket.emailSubject}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Work Start Date</div>
              <div className="text-lg font-medium text-gray-900">
                {ticket.workStartDate ? new Date(ticket.workStartDate).toLocaleDateString() : '—'}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-sm text-gray-600">Parsed Address</div>
            <div className="text-lg font-medium text-gray-900">
              {editing ? (
                <input
                  type="text"
                  value={formData.parsedAddress}
                  onChange={(e) => setFormData({ ...formData, parsedAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              ) : (
                ticket.parsedAddress || '—'
              )}
            </div>
          </div>
        </div>

        {/* Raw Email Body - Collapsible */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <button
            onClick={() => setEmailExpanded(!emailExpanded)}
            className="w-full flex justify-between items-center font-semibold text-gray-900 hover:text-gray-600"
          >
            <span>Raw Email Body</span>
            <span>{emailExpanded ? '▼' : '▶'}</span>
          </button>
          {emailExpanded && (
            <div className="mt-4 p-4 bg-gray-50 rounded border border-gray-200 overflow-auto max-h-96">
              <pre className="font-mono text-sm text-gray-800 whitespace-pre-wrap break-words">
                {ticket.emailBody}
              </pre>
            </div>
          )}
        </div>

        {/* Matched Orders */}
        {ticket.matchedOrders && ticket.matchedOrders.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Matched Orders</h2>
            <div className="space-y-3">
              {ticket.matchedOrders.map((order) => (
                <div key={order.id} className="flex justify-between items-center p-4 bg-gray-50 rounded">
                  <div>
                    <Link href={`/admin/orders/${order.id}`}>
                      <span className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer">
                        {order.orderNumber}
                      </span>
                    </Link>
                    <div className="text-sm text-gray-600">{order.address}</div>
                    <div className="text-sm text-gray-600">{order.realtorEmail}</div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      order.status === 'ON_HOLD'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin Notes */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Admin Notes</h2>
          {editing ? (
            <textarea
              value={formData.adminNotes}
              onChange={(e) => setFormData({ ...formData, adminNotes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg h-32"
              placeholder="Add admin notes..."
            />
          ) : (
            <div className="p-4 bg-gray-50 rounded">
              {ticket.adminNotes || 'No notes'}
            </div>
          )}
        </div>

        {/* Cleared Info (if applicable) */}
        {ticket.status === 'CLEARED' && ticket.clearedByUser && (
          <div className="bg-green-50 rounded-lg shadow-md p-6 mb-6 border border-green-200">
            <h2 className="text-lg font-semibold text-green-900 mb-2">Cleared By</h2>
            <div className="text-green-800">
              <div>{ticket.clearedByUser.name}</div>
              <div className="text-sm">{ticket.clearedByUser.email}</div>
              <div className="text-sm">
                {ticket.clearedAt && new Date(ticket.clearedAt).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          {editing ? (
            <>
              <button
                onClick={handleUpdate}
                disabled={processing}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {processing ? 'Saving...' : 'Save Changes'}
              </button>
              {ticket.status !== 'CLEARED' && (
                <>
                  <button
                    onClick={handleClear}
                    disabled={processing}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {processing ? 'Clearing...' : 'Mark Cleared'}
                  </button>
                  <button
                    onClick={handleDismiss}
                    disabled={processing}
                    className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400"
                  >
                    {processing ? 'Dismissing...' : 'Dismiss'}
                  </button>
                </>
              )}
              <button
                onClick={() => setEditing(false)}
                className="px-6 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Edit & Take Action
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
