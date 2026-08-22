'use client';

import { useState, useEffect } from 'react';
import { PrinterModal } from './PrinterModal';

interface Printer {
  id: string;
  name: string;
  website?: string;
  phone?: string;
  email?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

interface PartnershipRequest {
  id: string;
  name: string;
  website: string;
  createdAt: string;
  requestedByUser: { firstName: string; lastName: string; email: string };
}

export function PrintersTab() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [requests, setRequests] = useState<PartnershipRequest[]>([]);
  const [requestError, setRequestError] = useState('');
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);

  useEffect(() => {
    fetchPrinters();
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/admin/printer-partnership-requests');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load printer requests');
      setRequests(data.requests || []);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Failed to load printer requests');
    }
  };

  const reviewRequest = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    setReviewingRequestId(requestId);
    setRequestError('');
    try {
      const response = await fetch('/api/admin/printer-partnership-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, decision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to review printer request');
      setRequests((previous) => previous.filter((request) => request.id !== requestId));
      if (decision === 'APPROVED') await fetchPrinters();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Failed to review printer request');
    } finally {
      setReviewingRequestId(null);
    }
  };

  const fetchPrinters = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/printers');
      if (res.ok) {
        const data = await res.json();
        setPrinters(data.printers || []);
      }
    } catch (error) {
      console.error('Failed to fetch printers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this printer?')) return;
    try {
      const res = await fetch(`/api/admin/printers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPrinters(printers.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleSavePrinter = async () => {
    await fetchPrinters();
    setShowModal(false);
    setEditingPrinter(null);
  };

  return (
    <div>
      {requests.length > 0 && (
        <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-lg font-bold text-amber-950">Pending printer requests</h2>
          <div className="mt-3 space-y-3">
            {requests.map((request) => (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-4">
                <div>
                  <p className="font-semibold text-gray-900">{request.name}</p>
                  <a href={request.website} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">{request.website}</a>
                  <p className="mt-1 text-xs text-gray-500">Requested by {request.requestedByUser.firstName} {request.requestedByUser.lastName} ({request.requestedByUser.email})</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void reviewRequest(request.id, 'REJECTED')} disabled={reviewingRequestId === request.id} className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Reject</button>
                  <button type="button" onClick={() => void reviewRequest(request.id, 'APPROVED')} disabled={reviewingRequestId === request.id} className="rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50">Approve</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {requestError && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{requestError}</p>}
      {/* Add Printer Button */}
      <button
        onClick={() => {
          setEditingPrinter(null);
          setShowModal(true);
        }}
        className="mb-6 px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
      >
        + Add Printer
      </button>

      {/* Printers Table */}
      {loading ? (
        <div className="text-center py-12">Loading printers...</div>
      ) : printers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No printers found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  Website
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  Phone
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {printers.map((printer) => (
                <tr key={printer.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{printer.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {printer.website ? (
                      <a
                        href={printer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        {printer.website}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{printer.phone || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{printer.email || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        printer.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {printer.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm space-x-2">
                    <button
                      onClick={() => {
                        setEditingPrinter(printer);
                        setShowModal(true);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(printer.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <PrinterModal
          printer={editingPrinter}
          onClose={() => {
            setShowModal(false);
            setEditingPrinter(null);
          }}
          onSave={handleSavePrinter}
        />
      )}
    </div>
  );
}
