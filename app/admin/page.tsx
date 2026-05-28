'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
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
} from 'recharts';

interface DashboardMetrics {
  revenueToday: number;
  revenueLastMonth: number;
  revenueThisMonth: number;
  revenueGrowthPercent: number;
  ordersThisWeekByType: Record<string, number>;
  completionRate: number;
  outstandingInvoiceTotal: number;
  activeRealtorsThisMonth: number;
  signsDeployedRatio: string;
  avgJobCompletionTimeHours: number;
}

interface RevenueData {
  date: string;
  revenue: number;
}

interface OrdersData {
  week: string;
  INSTALL: number;
  REMOVAL: number;
  CHANGE: number;
}

interface StatusData {
  name: string;
  value: number;
}

interface RealtorMetrics {
  id: string;
  name: string;
  email: string;
  orderCount: number;
  totalRevenue: number;
  lastOrderDate: string | null;
}

interface TechMetrics {
  id: string;
  name: string;
  email: string;
  jobsCompleted: number;
  avgCompletionTimeHours: number;
  openIssuesCount: number;
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [ordersData, setOrdersData] = useState<OrdersData[]>([]);
  const [statusData, setStatusData] = useState<StatusData[]>([]);
  const [realtors, setRealtors] = useState<RealtorMetrics[]>([]);
  const [techs, setTechs] = useState<TechMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7' | '30' | '90'>('30');

  useEffect(() => {
    fetchAnalyticsData();
  }, [dateRange]);

  async function fetchAnalyticsData() {
    try {
      setLoading(true);

      const now = new Date();
      const startDate = new Date();

      if (dateRange === '7') {
        startDate.setDate(now.getDate() - 7);
      } else if (dateRange === '30') {
        startDate.setDate(now.getDate() - 30);
      } else {
        startDate.setDate(now.getDate() - 90);
      }

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = now.toISOString().split('T')[0];

      const [
        metricsRes,
        revenueRes,
        ordersRes,
        statusRes,
        realtorsRes,
        techsRes,
      ] = await Promise.all([
        fetch(`/api/admin/analytics?section=dashboard&startDate=${startStr}&endDate=${endStr}`),
        fetch(`/api/admin/analytics?section=revenue&startDate=${startStr}&endDate=${endStr}`),
        fetch(`/api/admin/analytics?section=orders&startDate=${startStr}&endDate=${endStr}`),
        fetch(`/api/admin/analytics?section=status`),
        fetch(`/api/admin/analytics?section=realtors`),
        fetch(`/api/admin/analytics?section=techs`),
      ]);

      const [metricsData, revenueRaw, ordersRaw, statusRaw, realtorsRaw, techsRaw] =
        await Promise.all([
          metricsRes.json(),
          revenueRes.json(),
          ordersRes.json(),
          statusRes.json(),
          realtorsRes.json(),
          techsRes.json(),
        ]);

      setMetrics(metricsData);
      setRevenueData(revenueRaw.data || []);
      setOrdersData(ordersRaw.data || []);
      setStatusData(statusRaw.data || []);
      setRealtors(realtorsRaw.realtors || []);
      setTechs(techsRaw.techs || []);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 text-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-2">Real-time business metrics and insights</p>
        </div>

        {/* Date Range Picker */}
        <div className="flex gap-2">
          {(['7', '30', '90'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {range === '7' ? '7 Days' : range === '30' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Metrics - 8 Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Revenue Today"
            value={`$${metrics.revenueToday.toFixed(2)}`}
            color="bg-blue-50 text-blue-700 border-blue-200"
          />
          <MetricCard
            label="This Month vs Last"
            value={`${metrics.revenueGrowthPercent > 0 ? '+' : ''}${metrics.revenueGrowthPercent.toFixed(1)}%`}
            color={
              metrics.revenueGrowthPercent > 0
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }
          />
          <MetricCard
            label="Orders This Week"
            value={`${Object.values(metrics.ordersThisWeekByType).reduce((a, b) => a + b, 0)}`}
            color="bg-purple-50 text-purple-700 border-purple-200"
          />
          <MetricCard
            label="Completion Rate"
            value={`${metrics.completionRate.toFixed(1)}%`}
            color="bg-green-50 text-green-700 border-green-200"
          />
          <MetricCard
            label="Outstanding Invoices"
            value={`$${metrics.outstandingInvoiceTotal.toFixed(2)}`}
            color="bg-yellow-50 text-yellow-700 border-yellow-200"
          />
          <MetricCard
            label="Active Realtors"
            value={`${metrics.activeRealtorsThisMonth}`}
            color="bg-indigo-50 text-indigo-700 border-indigo-200"
          />
          <MetricCard
            label="Signs Deployed"
            value={metrics.signsDeployedRatio}
            color="bg-orange-50 text-orange-700 border-orange-200"
          />
          <MetricCard
            label="Avg Job Time"
            value={`${metrics.avgJobCompletionTimeHours.toFixed(1)}h`}
            color="bg-pink-50 text-pink-700 border-pink-200"
          />
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Line Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => `$${(value as number).toFixed(2)}`}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  dot={false}
                  strokeWidth={2}
                  name="Daily Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-72 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>

        {/* Order Status Donut Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Orders by Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  label
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} orders`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-72 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-6">
        {/* Orders Bar Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Orders by Type (Weekly)</h3>
          {ordersData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ordersData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="INSTALL" stackId="a" fill="#3b82f6" name="Installation" />
                <Bar dataKey="REMOVAL" stackId="a" fill="#ef4444" name="Removal" />
                <Bar dataKey="CHANGE" stackId="a" fill="#10b981" name="Change" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-72 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Realtors Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">Top Realtors</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Orders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Last Order
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {realtors.slice(0, 10).map((realtor) => (
                  <tr key={realtor.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{realtor.name}</div>
                      <div className="text-sm text-gray-500">{realtor.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{realtor.orderCount}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      ${realtor.totalRevenue.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {realtor.lastOrderDate
                        ? new Date(realtor.lastOrderDate).toLocaleDateString()
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {realtors.length === 0 && (
              <div className="px-6 py-12 text-center text-gray-500">No data available</div>
            )}
          </div>
        </div>

        {/* Field Tech Performance Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">Field Tech Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Completed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Avg Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Open Issues
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {techs.map((tech) => (
                  <tr key={tech.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{tech.name}</div>
                      <div className="text-sm text-gray-500">{tech.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{tech.jobsCompleted}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {tech.avgCompletionTimeHours.toFixed(1)}h
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          tech.openIssuesCount > 0
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {tech.openIssuesCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {techs.length === 0 && (
              <div className="px-6 py-12 text-center text-gray-500">No data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className={`rounded-lg border p-6 ${color}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}
