"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import StatusBadge from "@/app/components/StatusBadge";

interface OrderData {
  id: string;
  orderNumber: string;
  address: string;
  type: string;
  status: string;
  scheduledDate?: string;
  createdAt: string;
}

export default function OrdersListClient({
  initialOrders,
  initialTotalPages,
}: {
  initialOrders: OrderData[];
  initialTotalPages: number;
}) {
  const [orders, setOrders] = useState<OrderData[]>(initialOrders);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);

  // Initial data comes from the server component; only refetch when the
  // user changes the filter or page.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    async function fetchOrders() {
      try {
        setLoading(true);
        let url = `/api/orders?page=${page}&limit=20`;
        if (filter !== "ALL") {
          url += `&status=${filter}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        setOrders(data.orders || []);
        setTotalPages(data.pagination?.pages || 1);
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [filter, page]);

  const visibleOrders = search
    ? orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
          o.address.toLowerCase().includes(search.toLowerCase())
      )
    : orders;

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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order number or address..."
              className="w-full rounded-md border border-gray-300 px-4 py-2"
            />
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
      ) : visibleOrders.length === 0 ? (
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
                {visibleOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                    onClick={() => (window.location.href = `/dashboard/orders/${order.id}`)}
                  >
                    <td className="px-6 py-4 text-sm text-primary font-medium">
                      {order.orderNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 truncate">
                      {order.address}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{order.type}</td>
                    <td className="px-6 py-4 text-sm">
                      <StatusBadge status={order.status} />
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
