'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '@/app/components/ConfirmDialogProvider';

interface FieldTech {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  assignedJobCount: number;
}

interface Order {
  id: string;
  orderNumber: string;
  realtorId: string;
  realtor: {
    firstName: string;
    lastName: string;
  };
  address: string;
  type: string;
  scheduledDate: string;
}

interface JobAssignment {
  id: string;
  orderId: string;
  fieldTechId: string;
  scheduledFor: string;
  startedAt: string | null;
  completedAt: string | null;
  techNotes: string | null;
  order: {
    orderNumber: string;
    address: string;
    type: string;
    realtor: {
      firstName: string;
      lastName: string;
    };
  };
  fieldTech: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface SummaryCard {
  label: string;
  value: number;
  color: 'bg-gray-100' | 'bg-blue-100' | 'bg-yellow-100' | 'bg-green-100';
}

interface AssignmentModalState {
  isOpen: boolean;
  mode: 'assign' | 'reassign';
  orderId: string | null;
  jobId: string | null;
  currentTechId: string | null;
}

export default function JobsPage() {
  const confirm = useConfirm();
  const [unassignedOrders, setUnassignedOrders] = useState<Order[]>([]);
  const [assignedJobs, setAssignedJobs] = useState<JobAssignment[]>([]);
  const [fieldTechs, setFieldTechs] = useState<FieldTech[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assignment modal state
  const [modal, setModal] = useState<AssignmentModalState>({
    isOpen: false,
    mode: 'assign',
    orderId: null,
    jobId: null,
    currentTechId: null,
  });
  const [selectedTechId, setSelectedTechId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      // Fetch unassigned orders
      const unassignedRes = await fetch('/api/admin/assignments/unassigned');
      if (!unassignedRes.ok) throw new Error('Failed to fetch unassigned orders');
      const unassignedData = await unassignedRes.json();
      setUnassignedOrders(unassignedData);

      // Fetch assigned jobs
      const assignedRes = await fetch('/api/admin/assignments?status=active');
      if (!assignedRes.ok) throw new Error('Failed to fetch assigned jobs');
      const assignedData = await assignedRes.json();
      setAssignedJobs(assignedData);

      // Fetch field techs
      const techsRes = await fetch('/api/admin/field-techs');
      if (!techsRes.ok) throw new Error('Failed to fetch field techs');
      const techsData = await techsRes.json();
      setFieldTechs(techsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }

  function openAssignModal(orderId: string) {
    setSelectedTechId('');
    setSelectedDate('');
    setModal({
      isOpen: true,
      mode: 'assign',
      orderId,
      jobId: null,
      currentTechId: null,
    });
  }

  function openReassignModal(jobId: string, currentTechId: string, scheduledFor: string) {
    const date = new Date(scheduledFor).toISOString().split('T')[0];
    const time = new Date(scheduledFor).toTimeString().slice(0, 5);
    setSelectedTechId(currentTechId);
    setSelectedDate(`${date}T${time}`);
    setModal({
      isOpen: true,
      mode: 'reassign',
      orderId: null,
      jobId,
      currentTechId,
    });
  }

  function closeModal() {
    setModal({
      isOpen: false,
      mode: 'assign',
      orderId: null,
      jobId: null,
      currentTechId: null,
    });
    setSelectedTechId('');
    setSelectedDate('');
  }

  async function handleAssign() {
    if (!selectedTechId || !selectedDate) {
      toast.error('Please select a field tech and date/time');
      return;
    }

    try {
      setSubmitting(true);

      if (modal.mode === 'assign' && modal.orderId) {
        // Create new assignment
        const res = await fetch('/api/admin/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: modal.orderId,
            fieldTechId: selectedTechId,
            scheduledFor: new Date(selectedDate).toISOString(),
          }),
        });

        if (!res.ok) throw new Error('Failed to create assignment');
        
        // Remove from unassigned
        setUnassignedOrders(orders => orders.filter(o => o.id !== modal.orderId));
        
        // Refresh assigned jobs
        const assignedRes = await fetch('/api/admin/assignments?status=active');
        const assignedData = await assignedRes.json();
        setAssignedJobs(assignedData);

        closeModal();
        toast.success('Assignment created successfully!');
      } else if (modal.mode === 'reassign' && modal.jobId) {
        // Update existing assignment
        const res = await fetch(`/api/admin/assignments/${modal.jobId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fieldTechId: selectedTechId,
            scheduledFor: new Date(selectedDate).toISOString(),
          }),
        });

        if (!res.ok) throw new Error('Failed to update assignment');
        
        // Refresh assigned jobs
        const assignedRes = await fetch('/api/admin/assignments?status=active');
        const assignedData = await assignedRes.json();
        setAssignedJobs(assignedData);

        closeModal();
        toast.success('Assignment updated successfully!');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error submitting assignment');
      console.error('Error:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnassign(jobId: string) {
    const ok = await confirm({
      description: 'Are you sure you want to unassign this job?',
      confirmLabel: 'Unassign',
      destructive: true,
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/assignments/${jobId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete assignment');

      // Refresh data
      await fetchData();
      toast.success('Job unassigned successfully!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error unassigning job');
      console.error('Error:', err);
    }
  }

  // Calculate summary stats
  const unassignedCount = unassignedOrders.length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const jobsToday = assignedJobs.filter(j => {
    const jDate = new Date(j.scheduledFor);
    jDate.setHours(0, 0, 0, 0);
    return jDate.getTime() === today.getTime();
  }).length;

  const inProgress = assignedJobs.filter(j => j.startedAt && !j.completedAt).length;
  const completedToday = assignedJobs.filter(j => {
    if (!j.completedAt) return false;
    const cDate = new Date(j.completedAt);
    cDate.setHours(0, 0, 0, 0);
    return cDate.getTime() === today.getTime();
  }).length;

  const summaryCards: SummaryCard[] = [
    { label: 'Unassigned Orders', value: unassignedCount, color: 'bg-gray-100' },
    { label: 'Jobs Today', value: jobsToday, color: 'bg-blue-100' },
    { label: 'In Progress', value: inProgress, color: 'bg-yellow-100' },
    { label: 'Completed Today', value: completedToday, color: 'bg-green-100' },
  ];

  // Group assigned jobs by field tech
  const groupedJobs = assignedJobs.reduce((acc, job) => {
    const techName = `${job.fieldTech.firstName} ${job.fieldTech.lastName}`;
    if (!acc[techName]) {
      acc[techName] = [];
    }
    acc[techName].push(job);
    return acc;
  }, {} as Record<string, JobAssignment[]>);

  const getStatusBadge = (job: JobAssignment) => {
    if (job.completedAt) {
      return <span className="px-3 py-1 text-sm font-medium bg-green-100 text-green-700 rounded">Completed</span>;
    }
    if (job.startedAt) {
      return <span className="px-3 py-1 text-sm font-medium bg-yellow-100 text-yellow-700 rounded">Started</span>;
    }
    return <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded">Assigned</span>;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-4">Jobs Management</h1>
        <div className="text-center py-8">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Jobs Management</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {summaryCards.map((card) => (
          <div key={card.label} className={`${card.color} p-4 rounded-lg`}>
            <p className="text-sm font-medium text-gray-600">{card.label}</p>
            <p className="text-3xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Section 1: Unassigned Orders */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Unassigned Orders ({unassignedCount})</h2>
        {unassignedOrders.length === 0 ? (
          <div className="p-4 bg-gray-50 text-gray-500 rounded">
            No unassigned orders
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-4 py-2 text-left">Order #</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Realtor</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Address</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Scheduled Date</th>
                  <th className="border border-gray-300 px-4 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {unassignedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2 font-medium">{order.orderNumber}</td>
                    <td className="border border-gray-300 px-4 py-2">
                      {order.realtor.firstName} {order.realtor.lastName}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-sm">{order.address}</td>
                    <td className="border border-gray-300 px-4 py-2">{order.type}</td>
                    <td className="border border-gray-300 px-4 py-2 text-sm">
                      {order.scheduledDate ? formatDate(order.scheduledDate) : 'Not set'}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      <button
                        onClick={() => openAssignModal(order.id)}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        Assign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Assigned Jobs (grouped by field tech) */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Assigned Jobs</h2>
        {Object.entries(groupedJobs).length === 0 ? (
          <div className="p-4 bg-gray-50 text-gray-500 rounded">
            No assigned jobs
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedJobs).map(([techName, jobs]) => (
              <div key={techName} className="border border-gray-300 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-3 font-bold text-lg">
                  {techName}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border-t border-b border-gray-300 px-4 py-2 text-left">Order #</th>
                        <th className="border-t border-b border-gray-300 px-4 py-2 text-left">Address</th>
                        <th className="border-t border-b border-gray-300 px-4 py-2 text-left">Type</th>
                        <th className="border-t border-b border-gray-300 px-4 py-2 text-left">Scheduled</th>
                        <th className="border-t border-b border-gray-300 px-4 py-2 text-left">Status</th>
                        <th className="border-t border-b border-gray-300 px-4 py-2 text-left">Tech Notes</th>
                        <th className="border-t border-b border-gray-300 px-4 py-2 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((job) => (
                        <tr key={job.id} className="hover:bg-gray-50 border-b border-gray-300">
                          <td className="border-gray-300 px-4 py-2 font-medium">{job.order.orderNumber}</td>
                          <td className="border-gray-300 px-4 py-2 text-sm">{job.order.address}</td>
                          <td className="border-gray-300 px-4 py-2">{job.order.type}</td>
                          <td className="border-gray-300 px-4 py-2 text-sm">{formatDate(job.scheduledFor)}</td>
                          <td className="border-gray-300 px-4 py-2">{getStatusBadge(job)}</td>
                          <td className="border-gray-300 px-4 py-2 text-sm">{job.techNotes || '-'}</td>
                          <td className="border-gray-300 px-4 py-2 text-center">
                            <button
                              onClick={() => openReassignModal(job.id, job.fieldTechId, job.scheduledFor)}
                              className="px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-xs mr-2"
                            >
                              Reassign
                            </button>
                            <button
                              onClick={() => handleUnassign(job.id)}
                              className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                            >
                              Unassign
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-xl font-bold mb-4">
              {modal.mode === 'assign' ? 'Assign Order' : 'Reassign Job'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Field Tech</label>
                <select
                  value={selectedTechId}
                  onChange={(e) => setSelectedTechId(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="">Select field tech...</option>
                  {fieldTechs.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.firstName} {tech.lastName} ({tech.assignedJobCount} jobs)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Scheduled Date & Time</label>
                <input
                  type="datetime-local"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={submitting || !selectedTechId || !selectedDate}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
