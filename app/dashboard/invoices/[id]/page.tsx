"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
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

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [marked, setMarked] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (res.ok) {
        const data = await res.json();
        setInvoice(data);

        // Mark as viewed if it's SENT
        if (data.status === "SENT" && !marked) {
          markAsViewed();
        }
      }
    } catch (error) {
      console.error("Failed to fetch invoice:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsViewed = async () => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "VIEWED" }),
      });

      if (res.ok) {
        setMarked(true);
        await fetchInvoice();
      }
    } catch (error) {
      console.error("Failed to mark invoice as viewed:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-600">Loading invoice...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-600">Invoice not found</p>
      </div>
    );
  }

  const colors = statusColors[invoice.status];
  const balance =
    invoice.amount - invoice.discountAmount - (invoice.paidAmount || 0);
  const isOverdue =
    invoice.status === "OVERDUE" ||
    (invoice.dueDate && new Date(invoice.dueDate) < new Date());

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <Link
              href="/dashboard/invoices"
              className="text-blue-600 hover:text-blue-900 text-sm font-medium mb-3 block"
            >
              ← Back to Invoices
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              {invoice.invoiceNumber}
            </h1>
          </div>
          <span className={`px-4 py-2 rounded-lg font-semibold ${colors.bg} ${colors.text}`}>
            {invoice.status}
          </span>
        </div>

        {/* Status Alert */}
        {isOverdue && invoice.status !== "PAID" && (
          <div className="mb-8 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-orange-900 font-medium">
              ⚠️ This invoice is overdue. Please make payment as soon as possible.
            </p>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Invoice Details */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            {/* Invoice Items */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h2>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-gray-600">Subtotal</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${(invoice.amount / 100).toFixed(2)}
                    </p>
                  </div>
                </div>

                {invoice.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <p className="text-gray-700">Discount</p>
                    <p className="text-gray-700">
                      -${(invoice.discountAmount / 100).toFixed(2)}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200 flex justify-between">
                  <p className="text-lg font-semibold text-gray-900">Total Amount Due</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${((invoice.amount - invoice.discountAmount) / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Issued</p>
                <p className="font-medium text-gray-900">
                  {new Date(invoice.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Due</p>
                <p
                  className={`font-medium ${
                    isOverdue ? "text-orange-600" : "text-gray-900"
                  }`}
                >
                  {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "No due date"}
                </p>
              </div>
            </div>

            {/* Payment Info */}
            {invoice.status === "PAID" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-900 mb-3">Paid</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <p className="text-sm text-green-800">Amount Paid</p>
                    <p className="font-semibold text-green-900">
                      ${((invoice.paidAmount || 0) / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm text-green-800">Date</p>
                    <p className="font-semibold text-green-900">
                      {invoice.paidAt && invoice.paidAmount
                        ? new Date(invoice.paidAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {balance > 0 && invoice.status !== "PAID" && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-800">Outstanding Balance</p>
                <p className="text-2xl font-bold text-orange-600 mt-2">
                  ${(balance / 100).toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {/* Action Panel */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>

              {invoice.status === "PAID" ? (
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm font-medium text-green-900">✓ Paid in full</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Contact us to arrange payment for this invoice.
                  </p>
                  <button
                    onClick={() => (window.location.href = "mailto:support@example.com")}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
                  >
                    Contact Support
                  </button>
                </div>
              )}
            </div>

            {/* Invoice Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Info</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-gray-600">Invoice Number</dt>
                  <dd className="font-mono font-medium text-gray-900">
                    {invoice.invoiceNumber}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-600">Status</dt>
                  <dd>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}
                    >
                      {invoice.status}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
