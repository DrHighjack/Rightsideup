'use client';

import { useEffect, useState } from 'react';
import { ActivityAction } from '@prisma/client';

interface ActivityLogItem {
  id: string;
  userId: string;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  description: string;
  metadata: Record<string, any> | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface PaginatedResponse {
  logs: ActivityLogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ACTION_COLORS: Record<string, string> = {
  ORDER_CREATED: 'bg-blue-50 text-blue-700 border-blue-200',
  ORDER_STATUS_CHANGED: 'bg-purple-50 text-purple-700 border-purple-200',
  ORDER_CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  SIGN_STATUS_CHANGED: 'bg-green-50 text-green-700 border-green-200',
  JOB_ASSIGNED: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  TICKET_811_CLEARED: 'bg-orange-50 text-orange-700 border-orange-200',
  COUPON_REDEEMED: 'bg-pink-50 text-pink-700 border-pink-200',
  INVOICE_CREATED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('');

  useEffect(() => {
    fetchActivityLogs();
  }, [page, selectedAction, selectedEntityType]);

  async function fetchActivityLogs() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', '50');
      if (selectedAction) params.set('action', selectedAction);
      if (selectedEntityType) params.set('entityType', selectedEntityType);

      const response = await fetch(`/api/admin/activity?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch activity logs');
      }

      const data: PaginatedResponse = await response.json();
      setLogs(data.logs);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      setError('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString();
  }

  function getActionBadgeColor(action: string): string {
    return ACTION_COLORS[action] || 'bg-gray-50 text-gray-700 border-gray-200';
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-gray-600 mt-2">Audit trail of all system actions</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Action
              </label>
              <select
                value={selectedAction}
                onChange={(e) => {
                  setSelectedAction(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Actions</option>
                {Object.values(ActivityAction).map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Entity Type
              </label>
              <select
                value={selectedEntityType}
                onChange={(e) => {
                  setSelectedEntityType(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Types</option>
                <option value="Order">Order</option>
                <option value="Sign">Sign</option>
                <option value="JobAssignment">Job Assignment</option>
                <option value="Ticket811">811 Ticket</option>
                <option value="Coupon">Coupon</option>
                <option value="Invoice">Invoice</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 text-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading activity logs...</span>
          </div>
        )}

        {/* Activity Table */}
        {!loading && logs.length > 0 && (
          <>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Entity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="font-medium text-gray-900">
                          {log.user.firstName} {log.user.lastName}
                        </div>
                        <div className="text-gray-500 text-xs">{log.user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getActionBadgeColor(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <span className="font-medium">{log.entityType}</span>
                        <span className="text-gray-500 text-xs block">{log.entityId.substring(0, 8)}...</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div className="max-w-sm">{log.description}</div>
                        {log.metadata && (
                          <details className="mt-1">
                            <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-700">
                              View metadata
                            </summary>
                            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {!loading && logs.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-lg">No activity logs found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or check back later</p>
          </div>
        )}
      </div>
    </div>
  );
}
