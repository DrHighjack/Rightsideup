"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
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

        setOrders(data.orders);
        setTotalPages(data.pagination.pages);
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
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
      // Fetch all orders without pagination for CSV export
      let url = `/api/admin/orders?page=1&limit=10000`;
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
      const allOrders = data.orders;

      // Create CSV header
      const headers = ["Order #", "Realtor", "Email", "Address", "Type", "Status", "Date", "Scheduled Date"];
      const csv = [
        headers.join(","),
        ...allOrders.map((order: OrderData) =>
          [
            order.orderNumber,
            `"${order.realtor.firstName} ${order.realtor.lastName}"`,
            `"${order.realtor.id}"`,
            `"${order.address}"`,
            order.type,
            order.status,
            new Date(order.createdAt).toLocaleDateString(),
            order.scheduledDate ? new Date(order.scheduledDate).toLocaleDateString() : "",
          ].join(",")
        ),
      ].join("\n");

      // Download CSV
      const blob = new Blob([csv], { type: "text/csv" });
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
    } finally {
      setExporting(false);
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
    </div>
  );
}
