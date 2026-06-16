"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ClientStats {
  totalClientsAdded: number;
  clientsWithInstalls: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  avgOrdersPerClient: string;
  avgRevenuePerClient: string;
}

interface TopClient {
  id: string;
  name: string;
  email: string;
  orderCount: number;
  totalRevenue: number;
  hasInstall: boolean;
}

interface DashboardData {
  stats: ClientStats;
  topClients: TopClient[];
}

export default function SalesmenDashboard() {
  const { status, data: sessionData } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      const userRole = (sessionData?.user as any)?.role;
      if (!["ADMIN", "SALESMEN"].includes(userRole)) {
        router.push("/login");
      }
    }
  }, [status, router, sessionData]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/salesmen/stats");
        if (!res.ok) throw new Error("Failed to fetch stats");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError("Failed to load dashboard data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [status]);

  if (status === "loading" || loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (status !== "authenticated") {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{error}</div>
        </div>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Salesmen Dashboard</h1>
            <p className="text-gray-600 mt-2">Track your clients and install allocations</p>
          </div>
          {(sessionData?.user as any)?.role === "ADMIN" && (
            <Link href="/admin" className="text-green-600 hover:text-green-700 font-medium">
              ← Back to Admin
            </Link>
          )}
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* Clients Added */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-600">
            <p className="text-gray-600 text-sm font-medium">Clients Added</p>
            <p className="text-4xl font-bold text-gray-900 mt-2">{stats?.totalClientsAdded}</p>
            <p className="text-xs text-gray-500 mt-2">
              {stats?.clientsWithInstalls} with installs allocated
            </p>
          </div>

          {/* Total Orders */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-600">
            <p className="text-gray-600 text-sm font-medium">Total Orders</p>
            <p className="text-4xl font-bold text-gray-900 mt-2">{stats?.totalOrders}</p>
            <p className="text-xs text-gray-500 mt-2">
              {stats?.completedOrders} completed, {stats?.pendingOrders} pending
            </p>
          </div>

          {/* Total Revenue */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-600">
            <p className="text-gray-600 text-sm font-medium">Total Revenue</p>
            <p className="text-4xl font-bold text-gray-900 mt-2">
              ${(stats?.totalRevenue || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-500 mt-2">From completed orders</p>
          </div>

          {/* Avg Revenue Per Client */}
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-600">
            <p className="text-gray-600 text-sm font-medium">Avg Revenue/Client</p>
            <p className="text-4xl font-bold text-gray-900 mt-2">${stats?.avgRevenuePerClient}</p>
            <p className="text-xs text-gray-500 mt-2">
              {stats?.avgOrdersPerClient} orders per client
            </p>
          </div>
        </div>

        {/* Top Performing Clients */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-xl font-bold text-gray-900">Top Performing Clients</h2>
            <p className="text-sm text-gray-600">Your highest revenue-generating clients</p>
          </div>

          {data?.topClients && data.topClients.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Orders</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Install</th>
                </tr>
              </thead>
              <tbody>
                {data.topClients.map((client) => (
                  <tr key={client.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">
                      <div>
                        <p className="font-medium text-gray-900">{client.name}</p>
                        <p className="text-xs text-gray-500">{client.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{client.orderCount}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      ${client.totalRevenue.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {client.hasInstall ? (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                          ✓ Allocated
                        </span>
                      ) : (
                        <span className="text-gray-500 text-xs">Not allocated</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-8 text-center text-gray-600">
              No clients added yet
            </div>
          )}
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Manage Clients Card */}
          <Link
            href="/admin/salesmen/clients"
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border-l-4 border-blue-600 cursor-pointer"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">Manage Your Clients</h3>
            <p className="text-sm text-gray-600 mb-4">
              View your added clients and allocate free installs
            </p>
            <span className="text-blue-600 font-medium">Go to Clients →</span>
          </Link>

          {/* Admin Dashboard Card */}
          {(sessionData?.user as any)?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border-l-4 border-green-600 cursor-pointer"
            >
              <h3 className="text-lg font-bold text-gray-900 mb-2">Admin Dashboard</h3>
              <p className="text-sm text-gray-600 mb-4">
                Access full system controls and analytics
              </p>
              <span className="text-green-600 font-medium">Go to Admin →</span>
            </Link>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 How This Works</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Clients you allocate free installs to appear in your dashboard</li>
            <li>• Track orders and revenue from your closed clients</li>
            <li>• Manage installs and monitor client performance</li>
            <li>• Only orders from completed jobs count toward revenue</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
