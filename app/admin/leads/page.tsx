'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Lead {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  brokerage: string;
  status: 'NEW' | 'CONTACTED' | 'INTERESTED' | 'AWAITING_LISTING' | 'FOLLOW_UP_SCHEDULED' | 'CONVERTED' | 'NOT_INTERESTED' | 'INACTIVE';
  notes?: string;
  assignedToUserId?: string;
  assignedToUser?: User;
  convertedToClientId?: string;
  convertedToClient?: User;
  convertedAt?: string;
  followUpDate?: string;
  lastContactedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

interface Admin {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  NEW: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'New' },
  CONTACTED: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Contacted' },
  INTERESTED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Interested' },
  AWAITING_LISTING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Awaiting Listing' },
  FOLLOW_UP_SCHEDULED: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Follow-up Scheduled' },
  CONVERTED: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Converted' },
  NOT_INTERESTED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Not Interested' },
  INACTIVE: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Inactive' },
};

export default function LeadResponsesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [formData, setFormData] = useState({
    status: '',
    notes: '',
    assignedToUserId: '',
    followUpDate: '',
  });
  const [convertForm, setConvertForm] = useState({
    firstName: '',
    lastName: '',
    role: 'REALTOR',
    showPassword: false,
    tempPassword: '',
  });
  const [showConvertModal, setShowConvertModal] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated' && (session?.user as any)?.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }

    if (status === 'authenticated') {
      fetchLeads();
      fetchAdmins();
    }
  }, [status, session, router]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/leads');
      if (!response.ok) throw new Error('Failed to fetch leads');
      const data = await response.json();
      setLeads(data.leads || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const response = await fetch('/api/admin/users?role=ADMIN');
      if (response.ok) {
        const data = await response.json();
        setAdmins(data.users || []);
      }
    } catch (err) {
      console.error('Error fetching admins:', err);
    }
  };

  const openLeadDetail = async (lead: Lead) => {
    try {
      setModalLoading(true);
      const response = await fetch(`/api/admin/leads/${lead.id}`);
      if (!response.ok) throw new Error('Failed to fetch lead details');
      const data = await response.json();
      setSelectedLead(data);
      setFormData({
        status: data.status || '',
        notes: data.notes || '',
        assignedToUserId: data.assignedToUserId || '',
        followUpDate: data.followUpDate ? data.followUpDate.split('T')[0] : '',
      });
      setShowModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lead details');
    } finally {
      setModalLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedLead) return;
    try {
      setModalLoading(true);
      const response = await fetch(`/api/admin/leads/${selectedLead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: formData.status,
          notes: formData.notes,
          assignedToUserId: formData.assignedToUserId,
          followUpDate: formData.followUpDate,
          lastContactedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) throw new Error('Failed to save changes');
      alert('Lead updated successfully!');
      await fetchLeads();
      setShowModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setModalLoading(false);
    }
  };

  const handleConvertLead = async () => {
    if (!selectedLead) return;
    try {
      setModalLoading(true);
      const response = await fetch(`/api/admin/leads/${selectedLead.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: convertForm.firstName || selectedLead.fullName.split(' ')[0],
          lastName: convertForm.lastName || selectedLead.fullName.split(' ').slice(1).join(' '),
          role: convertForm.role,
        }),
      });

      if (!response.ok) throw new Error('Failed to convert lead');
      const data = await response.json();
      setConvertForm({ ...convertForm, tempPassword: data.tempPassword, showPassword: true });
      alert(`Lead converted! Temporary password: ${data.tempPassword}`);
      await fetchLeads();
      setShowConvertModal(false);
      setShowModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert lead');
    } finally {
      setModalLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leads...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Lead Responses</h1>
          <p className="mt-2 text-gray-600">
            Free sign installation claims from Seattle agents — manage, contact, and convert to clients
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Total Leads</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{leads.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">This Week</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {leads.filter((l) => {
                const date = new Date(l.createdAt);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return date > weekAgo;
              }).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Converted</div>
            <div className="mt-2 text-3xl font-bold text-emerald-600">
              {leads.filter((l) => l.status === 'CONVERTED').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Unique Brokerages</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {new Set(leads.map((l) => l.brokerage)).size}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {leads.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No leads yet</h3>
              <p className="mt-1 text-sm text-gray-500">Leads will appear here when agents claim free installations</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brokerage</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {leads.map((lead) => {
                    const colors = statusColors[lead.status];
                    return (
                      <tr key={lead.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openLeadDetail(lead)}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lead.fullName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                          <a href={`mailto:${lead.email}`} onClick={(e) => e.stopPropagation()} className="hover:text-blue-900">
                            {lead.email}
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                          <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-blue-900">
                            {lead.phone}
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{lead.brokerage}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
                            {colors.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(lead.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button onClick={() => openLeadDetail(lead)} className="text-blue-600 hover:text-blue-900 font-medium">
                            View Details →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Lead Detail Modal */}
      {showModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedLead.fullName}</h2>
                <p className="text-gray-500">{selectedLead.brokerage}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <a href={`mailto:${selectedLead.email}`} className="text-blue-600 hover:text-blue-900 font-medium">
                    {selectedLead.email}
                  </a>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <a href={`tel:${selectedLead.phone}`} className="text-blue-600 hover:text-blue-900 font-medium">
                    {selectedLead.phone}
                  </a>
                </div>
              </div>

              {/* Status Badge */}
              <div>
                <p className="text-sm text-gray-600 mb-2">Current Status</p>
                <span className={`inline-block px-4 py-2 rounded-lg text-sm font-semibold ${statusColors[selectedLead.status].bg} ${statusColors[selectedLead.status].text}`}>
                  {statusColors[selectedLead.status].label}
                </span>
              </div>

              {/* Status Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Update Status</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  {Object.entries(statusColors).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignment */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Assign To</label>
                <select value={formData.assignedToUserId} onChange={(e) => setFormData({ ...formData, assignedToUserId: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="">Unassigned</option>
                  {admins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.firstName} {admin.lastName}
                    </option>
                  ))}
                </select>
                {selectedLead.assignedToUser && (
                  <p className="text-sm text-gray-600 mt-1">
                    Currently assigned to: {selectedLead.assignedToUser.firstName} {selectedLead.assignedToUser.lastName}
                  </p>
                )}
              </div>

              {/* Follow-up Date */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Follow-up Date</label>
                <input type="date" value={formData.followUpDate} onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                {selectedLead.followUpDate && (
                  <p className="text-sm text-gray-600 mt-1">
                    Next follow-up: {new Date(selectedLead.followUpDate).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add internal notes about this lead..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Conversion Info */}
              {selectedLead.convertedToClient ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-emerald-900">✓ Converted to Client</p>
                  <p className="text-sm text-emerald-800 mt-1">
                    Name: {selectedLead.convertedToClient.firstName} {selectedLead.convertedToClient.lastName}
                  </p>
                  <p className="text-sm text-emerald-800">Email: {selectedLead.convertedToClient.email}</p>
                  <p className="text-sm text-emerald-800">Converted on: {new Date(selectedLead.convertedAt!).toLocaleDateString()}</p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-900">Ready to convert this lead to a client?</p>
                  <p className="text-sm text-blue-700 mt-1">Converting creates a new user account and generates a temporary password.</p>
                </div>
              )}

              {/* Timestamps */}
              <div className="text-xs text-gray-500 space-y-1 border-t border-gray-200 pt-4">
                <p>Submitted: {new Date(selectedLead.createdAt).toLocaleString()}</p>
                {selectedLead.lastContactedAt && <p>Last contacted: {new Date(selectedLead.lastContactedAt).toLocaleString()}</p>}
                {selectedLead.updatedAt && <p>Last updated: {new Date(selectedLead.updatedAt).toLocaleString()}</p>}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
              {!selectedLead.convertedToClient && (
                <button
                  onClick={() => setShowConvertModal(true)}
                  disabled={modalLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-lg"
                >
                  Convert to Client
                </button>
              )}
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg">
                Close
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={modalLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg"
              >
                {modalLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Client Modal */}
      {showConvertModal && selectedLead && !selectedLead.convertedToClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">Convert Lead to Client</h2>
              <p className="text-sm text-gray-600 mt-1">This will create a new user account for {selectedLead.fullName}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">First Name</label>
                <input
                  type="text"
                  value={convertForm.firstName}
                  onChange={(e) => setConvertForm({ ...convertForm, firstName: e.target.value })}
                  placeholder={selectedLead.fullName.split(' ')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Last Name</label>
                <input
                  type="text"
                  value={convertForm.lastName}
                  onChange={(e) => setConvertForm({ ...convertForm, lastName: e.target.value })}
                  placeholder={selectedLead.fullName.split(' ').slice(1).join(' ')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Role</label>
                <select value={convertForm.role} onChange={(e) => setConvertForm({ ...convertForm, role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="REALTOR">Realtor</option>
                  <option value="SALESMEN">Salesman</option>
                  <option value="TC">Team Captain</option>
                </select>
              </div>

              {convertForm.showPassword && convertForm.tempPassword && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-xs text-emerald-600 font-semibold">Temporary Password:</p>
                  <p className="text-sm font-mono bg-white p-2 rounded mt-1 border border-emerald-200">{convertForm.tempPassword}</p>
                  <p className="text-xs text-emerald-600 mt-2">Share this with the client. They must change it on first login.</p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
              <button onClick={() => setShowConvertModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleConvertLead} disabled={modalLoading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-lg">
                {modalLoading ? 'Converting...' : 'Create Client Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
