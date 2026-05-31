"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ActiveAgent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  address: string;
  createdAt: string;
  realtor: {
    firstName: string;
    lastName: string;
  };
}

export default function TCDashboardPage() {
  const router = useRouter();
  const [activeAgent, setActiveAgent] = useState<ActiveAgent | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // Check if activeAgent is stored in localStorage
    const stored = localStorage.getItem("tc_active_agent");
    if (!stored) {
      // No agent selected, redirect to select-agent
      router.push("/tc/select-agent");
      return;
    }

    try {
      const agent = JSON.parse(stored) as ActiveAgent;
      setActiveAgent(agent);
    } catch {
      console.error("Invalid stored agent data");
      localStorage.removeItem("tc_active_agent");
      router.push("/tc/select-agent");
      return;
    }

    // Fetch orders for this agent
    const fetchOrders = async () => {
      try {
        const res = await fetch(
          `/api/orders?realtorId=${stored ? JSON.parse(stored).id : ""}`
        );

        if (!res.ok) {
          if (res.status === 401) {
            router.push("/login");
            return;
          }
          setError("Failed to load orders");
          setLoading(false);
          return;
        }

        const data = await res.json();
        setOrders(data.orders || []);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching orders:", err);
        setError("Failed to load orders");
        setLoading(false);
      }
    };

    fetchOrders();
  }, [router]);

  const handleSwitchAgent = () => {
    localStorage.removeItem("tc_active_agent");
    router.push("/tc/select-agent");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="animate-pulse">
          <div className="h-20 bg-gradient-to-r from-indigo-600 to-indigo-700"></div>
          <div className="max-w-6xl mx-auto p-6">
            <div className="h-40 bg-gray-300 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Acting-As Banner */}
      {activeAgent && (
        <div className="sticky top-0 z-50 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <div>
                <p className="text-sm font-medium opacity-90">Acting as</p>
                <p className="text-lg font-bold">
                  {activeAgent.firstName} {activeAgent.lastName}
                </p>
                <p className="text-xs opacity-75">{activeAgent.email}</p>
              </div>
            </div>
            <button
              onClick={handleSwitchAgent}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors font-medium text-sm"
            >
              Switch Agent
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm mb-2">Total Orders</p>
            <p className="text-3xl font-bold text-gray-900">{orders.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm mb-2">Pending</p>
            <p className="text-3xl font-bold text-amber-600">
              {orders.filter((o) => o.status === "PENDING").length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm mb-2">Confirmed</p>
            <p className="text-3xl font-bold text-blue-600">
              {orders.filter((o) => o.status === "CONFIRMED").length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm mb-2">Completed</p>
            <p className="text-3xl font-bold text-green-600">
              {orders.filter((o) => o.status === "COMPLETED" || o.status === "IN_GROUND").length}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Orders Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {activeAgent?.firstName}'s Orders
            </h2>
          </div>

          {orders.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p>No orders found for this agent</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                        {order.orderNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                            order.status === "PENDING"
                              ? "bg-amber-100 text-amber-700"
                              : order.status === "CONFIRMED"
                              ? "bg-blue-100 text-blue-700"
                              : order.status === "COMPLETED" || order.status === "IN_GROUND"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {order.address}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          href={`/orders/${order.id}`}
                          className="text-indigo-600 hover:text-indigo-900 font-medium"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-8 px-6 py-4">
          <Link
            href="/tc/dashboard"
            className="text-indigo-600 font-medium border-b-2 border-indigo-600 pb-1"
          >
            📊 Dashboard
          </Link>
          <Link
            href="/tc/pricing"
            className="text-gray-700 hover:text-indigo-600 font-medium transition-colors"
          >
            💰 Pricing
          </Link>
        </div>
      </div>

      {/* Spacer for bottom nav */}
      <div className="h-20"></div>
    </div>
  );
}
