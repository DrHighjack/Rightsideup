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
}

const statusColors: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-800" },
  SENT: { bg: "bg-blue-100", text: "text-blue-800" },
  VIEWED: { bg: "bg-purple-100", text: "text-purple-800" },
  PAID: { bg: "bg-green-100", text: "text-green-800" },
  VOIDED: { bg: "bg-red-100", text: "text-red-800" },
  OVERDUE: { bg: "bg-orange-100", text: "text-orange-800" },
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [offset, setOffset] = useState(0);

  const limit = 20;

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, offset]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      let url = `/api/invoices?limit=${limit}&offset=${offset}`;
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

  const formatCurrency = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString();
  };

  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  // Calculate summary stats
  const paidAmount = invoices
    .filter((inv) => inv.status === "PAID")
    .reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);

  const outstandingAmount = invoices
    .filter((inv) => ["SENT", "VIEWED", "OVERDUE"].includes(inv.status))
    .reduce((sum, inv) => sum + (inv.amount - inv.discountAmount), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Invoices</h1>
          <p className="text-gray-600 mt-2">View and manage your invoices</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium">Total Invoices</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{totalCount}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium">Amount Paid</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {formatCurrency(paidAmount)}
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium">Outstanding</p>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              {formatCurrency(outstandingAmount)}
            </p>
          </div>
        </div>

        {/* Status Filter */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {["", "PAID", "SENT", "OVERDUE", "VIEWED", "DRAFT"].map((status) => (
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
          ))}
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading invoices...</div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No invoices yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                      Invoice #
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
                      Amount Paid
                    </th>
                    <th className="text-right px-6 py-3 font-semibold text-gray-900 text-sm">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const colors = statusColors[invoice.status];
                    const balance = invoice.amount - invoice.discountAmount - (invoice.paidAmount || 0);
                    return (
                      <tr key={invoice.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-6 py-4 font-mono text-gray-900 font-medium">
                          <Link
                            href={`/dashboard/invoices/${invoice.id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            {invoice.invoiceNumber}
                          </Link>
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
                        <td className="px-6 py-4 text-right font-medium text-green-600">
                          {invoice.paidAmount ? formatCurrency(invoice.paidAmount * 100) : "—"}
                        </td>
                        <td className="px-6 py-4 text-right font-medium">
                          <span className={balance > 0 ? "text-orange-600" : "text-green-600"}>
                            {formatCurrency(balance * 100)}
                          </span>
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
    </div>
  );
}
