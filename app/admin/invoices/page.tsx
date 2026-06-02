"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  discountAmount: number;
  status: "DRAFT" | "SENT" | "VIEWED" | "PAID" | "VOIDED" | "OVERDUE";
  dueDate: string | null;
  paidAt: string | null;
  paidAmount: number | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

const statusColors: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-800" },
  SENT: { bg: "bg-blue-100", text: "text-blue-800" },
  VIEWED: { bg: "bg-purple-100", text: "text-purple-800" },
  PAID: { bg: "bg-green-100", text: "text-green-800" },
  VOIDED: { bg: "bg-red-100", text: "text-red-800" },
  OVERDUE: { bg: "bg-orange-100", text: "text-orange-800" },
};

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    userId: "",
    amount: "",
    discountAmount: "",
    dueDate: "",
  });
  const [createError, setCreateError] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const limit = 20;

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, offset]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      let url = `/api/admin/invoices?limit=${limit}&offset=${offset}`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices);
        setTotalCount(data.total);
      }
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async () => {
    if (!createForm.userId || !createForm.amount) {
      setCreateError("User and amount are required");
      return;
    }

    try {
      setCreateSubmitting(true);
      setCreateError("");

      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: createForm.userId,
          amount: parseFloat(createForm.amount),
          discountAmount: createForm.discountAmount
            ? parseFloat(createForm.discountAmount)
            : 0,
          dueDate: createForm.dueDate || undefined,
        }),
      });

      if (res.ok) {
        alert("Invoice created successfully!");
        setCreateForm({
          userId: "",
          amount: "",
          discountAmount: "",
          dueDate: "",
        });
        setShowCreateModal(false);
        await fetchInvoices();
      } else {
        const error = await res.json();
        setCreateError(error.error || "Failed to create invoice");
      }
    } catch (error) {
      setCreateError("Failed to create invoice");
      console.error(error);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString();
  };

  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
            <p className="text-gray-600 mt-2">
              Manage and track all customer invoices
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
          >
            + Create Invoice
          </button>
        </div>

        {/* Status Filter */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {["", "DRAFT", "SENT", "VIEWED", "PAID", "OVERDUE", "VOIDED"].map(
            (status) => (
              <button
                key={status || "all"}
                onClick={() => {
                  setStatusFilter(status);
                  setOffset(0);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  statusFilter === status
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {status || "All"}
              </button>
            )
          )}
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading invoices...</div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="mb-4">No invoices found</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-blue-600 hover:text-blue-900 font-medium"
              >
                Create the first invoice
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                      Invoice #
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                      Customer
                    </th>
                    <th className="text-right px-6 py-3 font-semibold text-gray-900 text-sm">
                      Amount
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                      Due Date
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                      Status
                    </th>
                    <th className="text-right px-6 py-3 font-semibold text-gray-900 text-sm">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const colors = statusColors[invoice.status];
                    return (
                      <tr key={invoice.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-6 py-4 font-mono text-gray-900 font-medium">
                          {invoice.invoiceNumber}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          <div className="font-medium">{invoice.user.name}</div>
                          <div className="text-sm text-gray-500">{invoice.user.email}</div>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">
                          {formatCurrency(invoice.amount * 100)}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {formatDate(invoice.dueDate)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}
                          >
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/admin/invoices/${invoice.id}`}
                            className="text-blue-600 hover:text-blue-900 font-medium text-sm"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Showing {offset + 1} to {Math.min(offset + limit, totalCount)} of{" "}
              {totalCount} invoices
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= totalCount}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Invoice</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  User Email *
                </label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={createForm.userId}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, userId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Note: Enter the user ID (for now, use test value)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Amount ($) *
                </label>
                <input
                  type="number"
                  placeholder="150.00"
                  step="0.01"
                  min="0"
                  value={createForm.amount}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, amount: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Discount Amount ($)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  value={createForm.discountAmount}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, discountAmount: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={createForm.dueDate}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, dueDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{createError}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateForm({
                    userId: "",
                    amount: "",
                    discountAmount: "",
                    dueDate: "",
                  });
                  setCreateError("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSubmit}
                disabled={createSubmitting}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg"
              >
                {createSubmitting ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
