"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AnalyticsData {
  revenueToday: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueGrowthPercent: number;
  ordersThisWeekByType: Record<string, number>;
  completionRate: number;
  outstandingInvoiceTotal: number;
  activeRealtorsThisMonth: number;
  signsDeployedRatio: string;
  avgJobCompletionTimeHours: number;
}

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/analytics?section=dashboard`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-600">Loading analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-600">Failed to load analytics</p>
      </div>
    );
  }

  // Prepare order type chart data
  const orderTypeData = Object.entries(data.ordersThisWeekByType).map(([type, count]) => ({
    name: type,
    value: count,
  })).filter(item => item.value > 0);

  const revenueGrowthLabel = data.revenueGrowthPercent > 0 ? "+" : "";

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Analytics Dashboard
            </h1>
            <p className="text-gray-600 mt-2">
              Key metrics and performance overview
            </p>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium">Revenue Today</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              ${(data.revenueToday / 100).toFixed(2)}
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium">This Month Revenue</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              ${(data.revenueThisMonth / 100).toFixed(2)}
            </p>
            <p className={`text-sm mt-2 ${data.revenueGrowthPercent > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {revenueGrowthLabel}{data.revenueGrowthPercent.toFixed(1)}% vs last month
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium">Completion Rate</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {data.completionRate.toFixed(1)}%
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <p className="text-gray-600 text-sm font-medium">Signs Deployed</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {data.signsDeployedRatio}
            </p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Orders This Week by Type */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Orders This Week by Type
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={orderTypeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Orders Distribution Pie */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Order Types This Week
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={orderTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {orderTypeData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Metrics Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Revenue Summary
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Last Month</span>
                <span className="text-xl font-bold text-gray-900">
                  ${(data.revenueLastMonth / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">This Month</span>
                <span className="text-xl font-bold text-green-600">
                  ${(data.revenueThisMonth / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <span className="text-gray-600">Growth</span>
                <span className={`text-xl font-bold ${data.revenueGrowthPercent > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {revenueGrowthLabel}{data.revenueGrowthPercent.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Key Performance Indicators
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Active Realtors (This Month)</span>
                <span className="text-xl font-bold text-gray-900">
                  {data.activeRealtorsThisMonth}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Avg Job Completion Time</span>
                <span className="text-xl font-bold text-gray-900">
                  {data.avgJobCompletionTimeHours.toFixed(1)}h
                </span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <span className="text-gray-600">Outstanding Invoices</span>
                <span className="text-xl font-bold text-orange-600">
                  ${(data.outstandingInvoiceTotal / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
