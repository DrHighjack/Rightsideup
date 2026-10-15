"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import StatusBadge from "@/app/components/StatusBadge";
import { formatOrderStatus, ORDER_STATUSES } from "@/lib/order-status";

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
  const { data: session } = useSession();
  const isSharedAccountant =
    session?.user?.role === "BROKERAGE" &&
    session?.user?.accountTitle === "Accountant";
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
        if (search.trim()) {
          url += `&search=${encodeURIComponent(search.trim())}`;
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
        const filtered: OrderData[] = sourceOrders;

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

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">My Orders</h1>
          <p className="text-gray-600">Manage and track your orders</p>
        </div>
        {!isSharedAccountant && <Link
          href="/dashboard/orders/new"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark md:w-auto md:px-6"
        >
          Place New Order
        </Link>}
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-3 md:p-4">
        <div className="space-y-3 md:space-y-4">
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
              placeholder="Search by realtor, order number, or address..."
              className="min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 text-base md:px-4"
            />
          </div>

          <div className="md:hidden">
            <label htmlFor="mobile-order-status" className="mb-1 block text-xs font-medium text-gray-600">Status</label>
            <select
              id="mobile-order-status"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
              className="min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-base"
            >
              <option value="ALL">All statuses</option>
              {ORDER_STATUSES.map((status) => <option key={status} value={status}>{formatOrderStatus(status)}</option>)}
            </select>
          </div>

          <div className="mb-4 hidden flex-wrap gap-2 md:flex">
            {["ALL", ...ORDER_STATUSES].map(
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
                  {status === "ALL" ? "All" : formatOrderStatus(status)}
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
              className="min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 text-base md:px-4"
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
          <div className="divide-y divide-gray-200 md:hidden">
            {orders.map((order) => (
              <Link key={order.id} href={`/dashboard/orders/${order.id}`} className="block p-3 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 font-semibold text-primary">{order.orderNumber}</span>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-1 text-sm font-medium leading-5 text-gray-900">{order.address}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span>{order.realtor ? `${order.realtor.firstName} ${order.realtor.lastName}` : "N/A"}</span>
                  <span>{order.type}</span>
                  <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
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
          <div className="flex items-center justify-between border-t border-gray-200 p-3 md:px-6 md:py-4">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50 md:px-4"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50 md:px-4"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
