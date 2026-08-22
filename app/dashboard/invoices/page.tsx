"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import PageSkeleton from "../../components/PageSkeleton";

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
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

type InvoicePeriod = "day" | "week" | "month" | "year" | "ytd";

const statusColors: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-800" },
  SENT: { bg: "bg-blue-100", text: "text-blue-800" },
  VIEWED: { bg: "bg-purple-100", text: "text-purple-800" },
  PAID: { bg: "bg-green-100", text: "text-green-800" },
  VOIDED: { bg: "bg-red-100", text: "text-red-800" },
  OVERDUE: { bg: "bg-orange-100", text: "text-orange-800" },
};

export default function InvoicesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const isTC = (session?.user as any)?.role === "TC";
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [availableCreditAmount, setAvailableCreditAmount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<InvoicePeriod>("month");
  const [invoiceStats, setInvoiceStats] = useState({
    paidInvoices: 0,
    unpaidInvoices: 0,
    averageInvoice: 0,
  });

  const limit = 20;

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, offset, period]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError("");
      let url = `/api/invoices?limit=${limit}&offset=${offset}&period=${period}`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load invoices");
      }
      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
      setTotalCount(data.total || 0);
      setAvailableCreditAmount(data.availableCreditAmount || 0);
      setInvoiceStats(data.stats || { paidInvoices: 0, unpaidInvoices: 0, averageInvoice: 0 });
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
      setInvoices([]);
      setTotalCount(0);
      setAvailableCreditAmount(0);
      setError(error instanceof Error ? error.message : "Failed to load invoices");
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
    .reduce(
      (sum, inv) => sum + inv.amount - inv.discountAmount + inv.taxAmount - (inv.paidAmount || 0),
      0
    );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Invoices</h1>
          <p className="text-gray-600 mt-2">View and manage your invoices</p>
        </div>

        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Invoice summary</h2>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Period
            <select
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value as InvoicePeriod);
                setOffset(0);
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
            >
              <option value="month">Month</option>
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="year">Year</option>
              <option value="ytd">YTD</option>
            </select>
          </label>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 mb-8 md:grid-cols-4 lg:grid-cols-7">
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

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium">Available Credit</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              ${availableCreditAmount.toFixed(2)}
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium">Paid Invoices</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{invoiceStats.paidInvoices}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium">Unpaid Invoices</p>
            <p className="text-3xl font-bold text-orange-600 mt-2">{invoiceStats.unpaidInvoices}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium">Average Invoice</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{formatCurrency(invoiceStats.averageInvoice)}</p>
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

        {/* Invoice Timeline */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Invoice timeline</h2>
          </div>
          {loading ? (
            <PageSkeleton variant="list" />
          ) : error ? (
            <div className="p-8 text-center">
              <p className="font-medium text-red-700">{error}</p>
              <button
                type="button"
                onClick={fetchInvoices}
                className="mt-3 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Try Again
              </button>
            </div>
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
                    {isTC && (
                      <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                        Agent
                      </th>
                    )}
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
                    const balance =
                      invoice.amount -
                      invoice.discountAmount +
                      invoice.taxAmount -
                      (invoice.paidAmount || 0);
                    return (
                      <tr
                        key={invoice.id}
                        className="cursor-pointer border-b border-gray-200 hover:bg-gray-50"
                        role="link"
                        tabIndex={0}
                        onClick={() => router.push(`/dashboard/invoices/${invoice.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            router.push(`/dashboard/invoices/${invoice.id}`);
                          }
                        }}
                      >
                        <td className="px-6 py-4 font-mono text-gray-900 font-medium">
                          <Link
                            href={`/dashboard/invoices/${invoice.id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            {invoice.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">
                          {formatCurrency(invoice.amount - invoice.discountAmount + invoice.taxAmount)}
                        </td>
                        {isTC && (
                          <td className="px-6 py-4 text-gray-700">
                            {invoice.user
                              ? `${invoice.user.firstName} ${invoice.user.lastName}`.trim()
                              : "Unknown agent"}
                          </td>
                        )}
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
                          {invoice.paidAmount ? formatCurrency(invoice.paidAmount) : "—"}
                        </td>
                        <td className="px-6 py-4 text-right font-medium">
                          <span className={balance > 0 ? "text-orange-600" : "text-green-600"}>
                            {formatCurrency(balance)}
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
