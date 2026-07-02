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
  realtor?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<"recent" | "agent">("recent");

  useEffect(() => {
    async function fetchOrders() {
      try {
        setLoading(true);
        setLoadError("");
        let url = `/api/orders?page=${page}&limit=20`;
        if (filter !== "ALL") {
          url += `&status=${filter}`;
        }

        const response = await fetch(url);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          setOrders([]);
          setTotalPages(1);
          setLoadError(data?.error || "Failed to load orders.");
          return;
        }

        const sourceOrders: OrderData[] = Array.isArray(data?.orders) ? data.orders : [];
        let filtered: OrderData[] = sourceOrders;
        if (search) {
          filtered = filtered.filter(
            (o: OrderData) =>
              o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
              o.address.toLowerCase().includes(search.toLowerCase())
          );
        }

        // Apply sorting
        if (sortBy === "agent") {
          filtered.sort((a, b) => {
            const aName = `${a.realtor?.firstName || ""} ${a.realtor?.lastName || ""}`.trim();
            const bName = `${b.realtor?.firstName || ""} ${b.realtor?.lastName || ""}`.trim();
            if (aName === bName) {
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            return aName.localeCompare(bName);
          });
        } else {
          filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        setOrders(filtered);
        setTotalPages(Math.max(1, Number(data?.pagination?.pages) || 1));
      } catch (error) {
        console.error("Failed to fetch orders:", error);
        setOrders([]);
        setTotalPages(1);
        setLoadError("Failed to load orders.");
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [filter, page, search, sortBy]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          <p className="text-gray-600">Manage and track your orders</p>
        </div>
        <Link
          href="/dashboard/orders/new"
          className="rounded-md bg-primary px-6 py-2 text-white font-medium hover:bg-primary-dark inline-block text-center"
        >
          Place New Order
        </Link>
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

          <div className="flex flex-wrap gap-2 mb-4">
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

          <div>
            <label htmlFor="sort" className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "recent" | "agent")}
              className="w-full rounded-md border border-gray-300 px-4 py-2"
            >
              <option value="recent">Most Recent</option>
              <option value="agent">Agent Name (then Recent)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders table */}
      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading orders...</div>
      ) : loadError ? (
        <div className="text-center text-red-700 py-8">{loadError}</div>
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
                    Agent
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
                    className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                    onClick={() => (window.location.href = `/dashboard/orders/${order.id}`)}
                  >
                    <td className="px-6 py-4 text-sm text-primary font-medium">
                      {order.orderNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {order.realtor ? `${order.realtor.firstName} ${order.realtor.lastName}` : "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate">
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
