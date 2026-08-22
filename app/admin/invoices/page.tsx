"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  discountAmount: number;
  taxAmount: number;
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

interface InvoiceStats {
  totalInvoices: number;
  amountPaid: number;
  outstandingAmount: number;
  paidInvoices: number;
  unpaidInvoices: number;
  averageInvoice: number;
}

const emptyInvoiceStats: InvoiceStats = {
  totalInvoices: 0,
  amountPaid: 0,
  outstandingAmount: 0,
  paidInvoices: 0,
  unpaidInvoices: 0,
  averageInvoice: 0,
};

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
  const [invoiceStats, setInvoiceStats] = useState<InvoiceStats>(emptyInvoiceStats);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [sendingId, setSendingId] = useState<string | null>(null);

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
        setInvoiceStats(data.stats || emptyInvoiceStats);
      }
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvoice = async (invoiceId: string) => {
    try {
      setSendingId(invoiceId);
      const res = await fetch(`/api/admin/invoices/${invoiceId}/send`, {
        method: "POST",
      });

      if (res.ok) {
        alert("Invoice sent successfully!");
        await fetchInvoices();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to send invoice");
      }
    } catch (error) {
      alert("Failed to send invoice");
      console.error(error);
    } finally {
      setSendingId(null);
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
          <Link
            href="/admin/invoices/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
          >
            + Create Invoice
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-600">Total Invoices</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{invoiceStats.totalInvoices}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-600">Amount Paid</p>
            <p className="mt-2 text-3xl font-bold text-green-600">{formatCurrency(invoiceStats.amountPaid)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-600">Outstanding</p>
            <p className="mt-2 text-3xl font-bold text-orange-600">{formatCurrency(invoiceStats.outstandingAmount)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-600">Paid Invoices</p>
            <p className="mt-2 text-3xl font-bold text-green-600">{invoiceStats.paidInvoices}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-600">Unpaid Invoices</p>
            <p className="mt-2 text-3xl font-bold text-orange-600">{invoiceStats.unpaidInvoices}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-600">Average Invoice</p>
            <p className="mt-2 text-3xl font-bold text-blue-600">{formatCurrency(invoiceStats.averageInvoice)}</p>
          </div>
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
              <Link
                href="/admin/invoices/new"
                className="text-blue-600 hover:text-blue-900 font-medium"
              >
                Create the first invoice
              </Link>
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
                          {formatCurrency(invoice.amount - invoice.discountAmount + invoice.taxAmount)}
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
                          <div className="flex gap-2 justify-end">
                            {invoice.status === "DRAFT" && (
                              <button
                                onClick={() => handleSendInvoice(invoice.id)}
                                disabled={sendingId === invoice.id}
                                className="text-green-600 hover:text-green-900 font-medium text-sm disabled:opacity-50"
                              >
                                {sendingId === invoice.id ? "Sending..." : "Send"}
                              </button>
                            )}
                            <Link
                              href={`/admin/invoices/${invoice.id}`}
                              className="text-blue-600 hover:text-blue-900 font-medium text-sm"
                            >
                              View
                            </Link>
                          </div>
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
