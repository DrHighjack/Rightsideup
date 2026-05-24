'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreateTicket811Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    ticketNumber: '',
    sourceEmail: '',
    emailSubject: '',
    emailBody: '',
    parsedAddress: '',
    workStartDate: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch('/api/admin/811', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ticketNumber: formData.ticketNumber,
          sourceEmail: formData.sourceEmail,
          emailSubject: formData.emailSubject,
          emailBody: formData.emailBody,
          parsedAddress: formData.parsedAddress || undefined,
          workStartDate: formData.workStartDate || undefined,
        }),
      });

      if (res.ok) {
        const ticket = await res.json();
        alert('Ticket created successfully');
        router.push(`/admin/811/${ticket.id}`);
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to create ticket:', error);
      alert('Failed to create ticket');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/admin/811" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to Tickets
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Create New 811 Ticket</h1>

        <div className="bg-white rounded-lg shadow-md p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Ticket Number *
              </label>
              <input
                type="text"
                required
                value={formData.ticketNumber}
                onChange={(e) => setFormData({ ...formData, ticketNumber: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 2026-05-24-999001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Source Email *
              </label>
              <input
                type="email"
                required
                value={formData.sourceEmail}
                onChange={(e) => setFormData({ ...formData, sourceEmail: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Email Subject *
              </label>
              <input
                type="text"
                required
                value={formData.emailSubject}
                onChange={(e) => setFormData({ ...formData, emailSubject: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="811 Ticket - Dig Safe Notice"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Email Body *
              </label>
              <textarea
                required
                value={formData.emailBody}
                onChange={(e) => setFormData({ ...formData, emailBody: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-32"
                placeholder="Full email body content..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Excavation Address
              </label>
              <input
                type="text"
                value={formData.parsedAddress}
                onChange={(e) => setFormData({ ...formData, parsedAddress: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="123 Main St, City, State 12345"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Work Start Date
              </label>
              <input
                type="date"
                value={formData.workStartDate}
                onChange={(e) => setFormData({ ...formData, workStartDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Creating...' : 'Create Ticket'}
              </button>
              <Link href="/admin/811">
                <button
                  type="button"
                  className="px-6 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
