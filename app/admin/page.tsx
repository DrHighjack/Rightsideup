"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface OrderData {
  id: string;
  orderNumber: string;
  address: string;
  type: string;
  status: string;
  createdAt: string;
  realtor: {
    firstName: string;
    lastName: string;
  };
}

interface DashboardStats {
  todayCount: number;
  pendingCount: number;
  scheduledCount: number;
  completedThisWeek: number;
  staleOrderCount: number;
  recentOrders: OrderData[];
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    todayCount: 0,
    pendingCount: 0,
    scheduledCount: 0,
    completedThisWeek: 0,
    staleOrderCount: 0,
    recentOrders: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/admin/orders?limit=10");
        const data = await response.json();

        if (data.orders) {
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);

          const todayCount = data.orders.filter((o: OrderData) => {
            const createdDate = new Date(o.createdAt);
            return createdDate >= today;
          }).length;

          const pendingCount = data.orders.filter(
            (o: OrderData) => o.status === "PENDING"
          ).length;

          const scheduledCount = data.orders.filter(
            (o: OrderData) => o.status === "SCHEDULED"
          ).length;

          const completedThisWeek = data.orders.filter((o: OrderData) => {
            if (o.status !== "COMPLETED") return false;
            const createdDate = new Date(o.createdAt);
            return createdDate >= weekAgo;
          }).length;

          const staleOrderCount = data.orders.filter(
            (o: OrderData) => (o as any).isStale === true
          ).length;

          setStats({
            todayCount,
            pendingCount,
            scheduledCount,
            completedThisWeek,
            staleOrderCount,
            recentOrders: data.orders.slice(0, 10),
          });
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return <div className="text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">System overview and key metrics</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">Today's Orders</p>
          <p className="text-3xl font-bold text-primary mt-2">{stats.todayCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">Pending</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.pendingCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">Scheduled</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{stats.scheduledCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">Completed This Week</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats.completedThisWeek}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
          <p className="text-sm font-medium text-yellow-700">Stale Orders</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.staleOrderCount}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-4">
        <Link
          href="/admin/orders/new"
          className="inline-block rounded-md bg-primary px-6 py-2 text-white font-medium hover:bg-primary-dark"
        >
          Create Order
        </Link>
        <Link
          href="/admin/orders"
          className="inline-block rounded-md border border-primary px-6 py-2 text-primary font-medium hover:bg-primary-light"
        >
          View All Orders
        </Link>
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
        </div>
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
              {stats.recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-primary font-medium">
                    <Link href={`/admin/orders/${order.id}`}>
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {order.realtor.firstName} {order.realtor.lastName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 truncate">
                    {order.address}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{order.type}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        order.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-800"
                          : order.status === "COMPLETED"
                          ? "bg-green-100 text-green-800"
                          : order.status === "CANCELLED"
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
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
      </div>
    </div>
  );
}
