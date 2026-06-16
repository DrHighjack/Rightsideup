'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  completionRate: number;
  activeRealtors: number;
  activeCoupons: number;
  discountGiven: number;
  smsSent: number;
  smsSuccessRate: number;
  recentOrders: any[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [realtors, setRealtors] = useState<any[]>([]);
  const [topSigns, setTopSigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch main dashboard stats
      const statsRes = await fetch(
        '/api/admin/analytics?section=dashboard'
      );
      if (!statsRes.ok) throw new Error('Failed to fetch dashboard stats');
      const statsData = await statsRes.json();
      setStats(statsData);

      // Fetch realtor performance
      const realtorsRes = await fetch('/api/admin/analytics?section=realtors');
      if (!realtorsRes.ok) throw new Error('Failed to fetch realtor data');
      const realtorsData = await realtorsRes.json();
      setRealtors(realtorsData.realtors || []);

      // Fetch top signs
      const signsRes = await fetch('/api/admin/analytics?section=signs');
      if (!signsRes.ok) throw new Error('Failed to fetch top signs');
      const signsData = await signsRes.json();
      setTopSigns(signsData.topSigns || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load dashboard'
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              label="Total Orders"
              value={stats.totalOrders}
              icon="📦"
            />
            <StatCard
              label="Total Revenue"
              value={`$${stats.totalRevenue.toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}`}
              icon="💰"
            />
            <StatCard
              label="Avg Order Value"
              value={`$${stats.averageOrderValue.toFixed(2)}`}
              icon="📊"
            />
            <StatCard
              label="Completion Rate"
              value={`${(stats.completionRate * 100).toFixed(1)}%`}
              icon="✅"
            />
            <StatCard
              label="Active Realtors"
              value={stats.activeRealtors}
              icon="👤"
            />
            <StatCard label="Active Coupons" value={stats.activeCoupons} icon="🎟️" />
            <StatCard
              label="Discount Given"
              value={`$${stats.discountGiven.toFixed(2)}`}
              icon="🏷️"
            />
            <StatCard
              label="SMS Success Rate"
              value={`${(stats.smsSuccessRate * 100).toFixed(1)}%`}
              icon="📱"
            />
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link
            href="/admin/orders"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
          >
            <div className="text-2xl mb-2">📋</div>
            <h3 className="font-semibold text-gray-900">View Orders</h3>
            <p className="text-gray-600 text-sm mt-1">Manage all orders</p>
          </Link>
          <Link
            href="/admin/coupons"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
          >
            <div className="text-2xl mb-2">🎟️</div>
            <h3 className="font-semibold text-gray-900">Manage Coupons</h3>
            <p className="text-gray-600 text-sm mt-1">Create and track coupons</p>
          </Link>
          <Link
            href="/admin/settings"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
          >
            <div className="text-2xl mb-2">⚙️</div>
            <h3 className="font-semibold text-gray-900">Settings</h3>
            <p className="text-gray-600 text-sm mt-1">System configuration</p>
          </Link>
        </div>

        {/* Realtor Performance */}
        {realtors.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Top Realtors
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Realtor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Orders
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Completion Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {realtors.slice(0, 5).map((realtor, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {realtor.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {realtor.orderCount}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        ${realtor.totalRevenue.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center">
                          <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{
                                width: `${(realtor.completionRate * 100).toFixed(1)}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-gray-600">
                            {(realtor.completionRate * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Signs */}
        {topSigns.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Top Performing Signs
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Sign Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Orders
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topSigns.map((sign, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {sign.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {sign.orderCount}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        ${sign.totalRevenue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-600 text-sm font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  );
}
