"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
  updatedAt: string;
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

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    status: "",
    dueDate: "",
    paidAmount: "",
    paidAt: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/invoices/${invoiceId}`);
      if (res.ok) {
        const data = await res.json();
        setInvoice(data);
        setEditForm({
          status: data.status,
          dueDate: data.dueDate?.split("T")[0] || "",
          paidAmount: data.paidAmount ? String(data.paidAmount) : "",
          paidAt: data.paidAt?.split("T")[0] || "",
        });
      }
    } catch (error) {
      console.error("Failed to fetch invoice:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/admin/invoices/${invoiceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        alert("Invoice sent successfully!");
        await fetchInvoice();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to send invoice");
      }
    } catch (error) {
      setError("Failed to send invoice");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    try {
      setSubmitting(true);
      setError("");

      const updateData: any = {};
      if (editForm.status) updateData.status = editForm.status;
      if (editForm.dueDate) updateData.dueDate = editForm.dueDate;
      if (editForm.paidAmount) updateData.paidAmount = parseFloat(editForm.paidAmount);
      if (editForm.paidAt) updateData.paidAt = editForm.paidAt;

      const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        alert("Invoice updated successfully!");
        await fetchInvoice();
        setEditing(false);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update invoice");
      }
    } catch (error) {
      setError("Failed to update invoice");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure? This action cannot be undone.")) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert("Invoice deleted successfully!");
        router.push("/admin/invoices");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete invoice");
      }
    } catch (error) {
      setError("Failed to delete invoice");
      console.error(error);
    } finally {
      setSubmitting(false);
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <Link
              href="/admin/invoices"
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

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Invoice Details */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h2>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Amount</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${(invoice.amount / 100).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Discount</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${(invoice.discountAmount / 100).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Due Date</p>
                  <p className="font-medium text-gray-900">
                    {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Created</p>
                  <p className="font-medium text-gray-900">
                    {new Date(invoice.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Customer</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="font-medium text-gray-900">{invoice.user.name}</p>
                <p className="text-gray-600">{invoice.user.email}</p>
              </div>
            </div>

            {/* Payment Info */}
            {invoice.status === "PAID" && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-900 mb-2">Paid</h3>
                <p className="text-sm text-green-800 mb-2">
                  Amount: ${((invoice.paidAmount || 0) / 100).toFixed(2)}
                </p>
                <p className="text-sm text-green-800">
                  Date: {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : "—"}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-4">
            {!editing && (
              <>
                {invoice.status === "DRAFT" && (
                  <>
                    <button
                      onClick={handleSend}
                      disabled={submitting}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg"
                    >
                      Send Invoice
                    </button>
                    <button
                      onClick={() => setEditing(true)}
                      className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium rounded-lg"
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={submitting}
                      className="w-full px-4 py-2 bg-red-100 hover:bg-red-200 text-red-900 font-medium rounded-lg"
                    >
                      Delete
                    </button>
                  </>
                )}
                {invoice.status === "SENT" && (
                  <button
                    onClick={() => setEditing(true)}
                    className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium rounded-lg"
                  >
                    Edit Status
                  </button>
                )}
              </>
            )}

            {editing && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({ ...editForm, status: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="SENT">Sent</option>
                    <option value="VIEWED">Viewed</option>
                    <option value="PAID">Paid</option>
                    <option value="OVERDUE">Overdue</option>
                    <option value="VOIDED">Voided</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) =>
                      setEditForm({ ...editForm, dueDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {editForm.status === "PAID" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Paid Amount ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.paidAmount}
                        onChange={(e) =>
                          setEditForm({ ...editForm, paidAmount: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Paid Date
                      </label>
                      <input
                        type="date"
                        value={editForm.paidAt}
                        onChange={(e) =>
                          setEditForm({ ...editForm, paidAt: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditing(false);
                      setError("");
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdate}
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg"
                  >
                    {submitting ? "Saving..." : "Save"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
