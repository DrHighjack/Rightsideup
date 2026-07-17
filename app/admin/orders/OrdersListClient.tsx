"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { usePrompt } from "@/app/components/ConfirmDialogProvider";

interface OrderData {
  id: string;
  orderNumber: string;
  address: string;
  type: string;
  status: string;
  scheduledDate?: string;
  createdAt: string;
  isStale: boolean;
  realtor: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface FieldTech {
  id: string;
  firstName: string;
  lastName: string;
}

export default function OrdersListClient({
  initialOrders,
  initialTotalPages,
  initialFieldTechs,
}: {
  initialOrders: OrderData[];
  initialTotalPages: number;
  initialFieldTechs: FieldTech[];
}) {
  const prompt = usePrompt();
  const [orders, setOrders] = useState<OrderData[]>(initialOrders);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [removalModal, setRemovalModal] = useState<{ isOpen: boolean; orderId: string | null }>({ isOpen: false, orderId: null });
  const [removalDate, setRemovalDate] = useState("");
  const [removalNotes, setRemovalNotes] = useState("");
  const [schedulingRemoval, setSchedulingRemoval] = useState(false);
  const fieldTechs = initialFieldTechs;
  const [selectedFieldTech, setSelectedFieldTech] = useState("");

  async function fetchOrders() {
    try {
      setLoading(true);
      let url = `/api/admin/orders?page=${page}&limit=20`;
      if (filter !== "ALL") {
        url += `&status=${filter}`;
      }
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }
      if (dateFrom) {
        url += `&dateFrom=${encodeURIComponent(dateFrom)}`;
      }
      if (dateTo) {
        url += `&dateTo=${encodeURIComponent(dateTo)}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      setOrders(data.orders || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      setOrders([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }

  // The server component already fetched page 1 with default filters, so
  // skip the redundant first client-side fetch and only refetch when the
  // user actually changes a filter/page after that.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page, search, dateFrom, dateTo]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  async function handleExportCSV() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("status", filter);
      if (search) params.set("search", search);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const response = await fetch(`/api/admin/orders/export?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to export CSV");

      const blob = await response.blob();
      const url_blob = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url_blob;
      a.download = `orders-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url_blob);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to export CSV:", error);
      toast.error("Failed to export CSV");
    } finally {
      setExporting(false);
    }
  }

  async function handleSendCompletionEmail(orderId: string) {
    const installationImageUrl = await prompt({
      title: "Send completion email",
      description: "Enter the installation image URL:",
      confirmLabel: "Send",
    });
    if (!installationImageUrl) return;

    try {
      setSendingId(orderId);
      const res = await fetch(`/api/admin/orders/${orderId}/send-completion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationImageUrl }),
      });

      if (res.ok) {
        toast.success("Completion email sent successfully!");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to send email");
      }
    } catch (error) {
      toast.error("Failed to send email");
      console.error(error);
    } finally {
      setSendingId(null);
    }
  }

  async function handleScheduleRemoval() {
    if (!removalModal.orderId || !removalDate) {
      toast.error("Please select a removal date");
      return;
    }

    try {
      setSchedulingRemoval(true);
      const res = await fetch(`/api/admin/orders/${removalModal.orderId}/schedule-removal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          removalScheduledDate: removalDate,
          removalNotes: removalNotes || undefined,
          fieldTechId: selectedFieldTech || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Removal scheduled successfully! Order: ${data.removalOrder.orderNumber}`);
        setRemovalModal({ isOpen: false, orderId: null });
        setRemovalDate("");
        setRemovalNotes("");
        setSelectedFieldTech("");
        fetchOrders();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to schedule removal");
      }
    } catch (error) {
      toast.error("Failed to schedule removal");
      console.error(error);
    } finally {
      setSchedulingRemoval(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">All Orders</h1>
          <p className="text-gray-600">Manage orders from all realtors</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="rounded-md bg-gray-600 px-6 py-2 text-white font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
          <Link
            href="/admin/orders/new"
            className="rounded-md bg-primary px-6 py-2 text-white font-medium hover:bg-primary-dark inline-block text-center"
          >
            Create Order
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="space-y-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              id="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by order number or address..."
              className="w-full rounded-md border border-gray-300 px-4 py-2"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700 mb-1">
                Date From
              </label>
              <input
                type="date"
                id="dateFrom"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-md border border-gray-300 px-4 py-2"
              />
            </div>
            <div>
              <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700 mb-1">
                Date To
              </label>
              <input
                type="date"
                id="dateTo"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-md border border-gray-300 px-4 py-2"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {["ALL", "PENDING", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map(
              (status) => (
                <button
                  key={status}
                  onClick={() => {
                    setFilter(status);
                    setPage(1);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filter === status
                      ? "bg-primary text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {status}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Orders table */}
      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-center text-gray-500 py-8">No orders found</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Order #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Realtor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className={`border-b border-gray-200 cursor-pointer transition-colors ${
                      order.isStale ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => (window.location.href = `/admin/orders/${order.id}`)}
                  >
                    <td className="px-6 py-4 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <span className="text-primary">{order.orderNumber}</span>
                        {order.isStale && (
                          <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">
                            ⚠️ Stale
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {order.realtor.firstName} {order.realtor.lastName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-xs">
                      {order.address}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{order.type}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        {order.status === "COMPLETED" && (
                          <button
                            onClick={() => handleSendCompletionEmail(order.id)}
                            disabled={sendingId === order.id}
                            className="text-green-600 hover:text-green-900 font-medium text-sm disabled:opacity-50"
                          >
                            {sendingId === order.id ? "Sending..." : "Send Email"}
                          </button>
                        )}
                        {order.type === "INSTALL" && order.status === "COMPLETED" && (
                          <button
                            onClick={() => {
                              setRemovalModal({ isOpen: true, orderId: order.id });
                              setRemovalDate("");
                              setRemovalNotes("");
                              setSelectedFieldTech("");
                            }}
                            className="text-orange-600 hover:text-orange-900 font-medium text-sm"
                          >
                            Schedule Removal
                          </button>
                        )}
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-blue-600 hover:text-blue-900 font-medium text-sm"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Schedule Removal Modal */}
      {removalModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Schedule Removal</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Removal Date *
                </label>
                <input
                  type="date"
                  value={removalDate}
                  onChange={(e) => setRemovalDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={removalNotes}
                  onChange={(e) => setRemovalNotes(e.target.value)}
                  placeholder="Add any notes about the removal..."
                  className="w-full rounded-md border border-gray-300 px-4 py-2 h-24 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign to Installer (Optional)
                </label>
                <select
                  value={selectedFieldTech}
                  onChange={(e) => setSelectedFieldTech(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-4 py-2"
                >
                  <option value="">Select an installer...</option>
                  {fieldTechs.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.firstName} {tech.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setRemovalModal({ isOpen: false, orderId: null });
                  setRemovalDate("");
                  setRemovalNotes("");
                  setSelectedFieldTech("");
                }}
                className="flex-1 px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleRemoval}
                disabled={schedulingRemoval || !removalDate}
                className="flex-1 px-4 py-2 rounded-md bg-orange-600 text-white font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                {schedulingRemoval ? "Scheduling..." : "Schedule Removal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
