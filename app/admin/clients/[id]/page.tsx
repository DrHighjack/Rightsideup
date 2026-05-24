"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";

interface Order {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  address: string;
  createdAt: string;
  scheduledDate?: string;
}

interface RealtorDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  paymentMethod: string;
  brokerageName?: string;
  createdAt: string;
}

interface RealtorStats {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
}

export default function RealtorDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const realtorId = params.id as string;

  const [realtor, setRealtor] = useState<RealtorDetail | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<RealtorStats>({
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "completed" | "cancelled">("all");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch realtor details
        const userRes = await fetch(`/api/admin/users/${realtorId}`);
        if (!userRes.ok) throw new Error("Failed to fetch realtor");
        const userData = await userRes.json();
        setRealtor(userData.user);

        // Fetch realtor's orders
        const ordersRes = await fetch(`/api/admin/users/${realtorId}/orders`);
        if (!ordersRes.ok) throw new Error("Failed to fetch orders");
        const ordersData = await ordersRes.json();
        setOrders(ordersData.orders || []);

        // Calculate stats
        const allOrders = ordersData.orders || [];
        setStats({
          totalOrders: allOrders.length,
          activeOrders: allOrders.filter((o: Order) => ["PENDING", "SCHEDULED", "IN_PROGRESS"].includes(o.status)).length,
          completedOrders: allOrders.filter((o: Order) => o.status === "COMPLETED").length,
          cancelledOrders: allOrders.filter((o: Order) => o.status === "CANCELLED").length,
        });
      } catch (err) {
        setError("Failed to load realtor details");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (status === "authenticated" && realtorId) {
      fetchData();
    }
  }, [status, realtorId]);

  const filteredOrders = orders.filter((order) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "active") return ["PENDING", "SCHEDULED", "IN_PROGRESS"].includes(order.status);
    if (filterStatus === "completed") return order.status === "COMPLETED";
    if (filterStatus === "cancelled") return order.status === "CANCELLED";
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "SCHEDULED":
        return "bg-blue-100 text-blue-800";
      case "IN_PROGRESS":
        return "bg-purple-100 text-purple-800";
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (status === "loading" || loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!realtor) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/admin/brokerages" className="text-green-600 hover:text-green-700 mb-4 inline-block">
            ← Back to Clients
          </Link>
          <div className="bg-red-50 p-4 rounded-lg text-red-800">Realtor not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/admin/brokerages" className="text-green-600 hover:text-green-700 mb-4 inline-block">
            ← Back to Clients
          </Link>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {realtor.firstName} {realtor.lastName}
                </h1>
                <p className="text-gray-600">{realtor.email}</p>
              </div>
              <Link
                href={`/admin/orders/new?realtorId=${realtorId}`}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Book Order
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600 text-sm">Phone</p>
                <p className="text-gray-900 font-medium">{realtor.phone || "—"}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Payment Method</p>
                <p className="text-gray-900 font-medium">
                  {realtor.paymentMethod === "OFFICE" ? "Office Pays" : "Agent Pays"}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Brokerage</p>
                <p className="text-gray-900 font-medium">{realtor.brokerageName || "—"}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Member Since</p>
                <p className="text-gray-900 font-medium">{formatDate(realtor.createdAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm font-medium">Total Orders</p>
            <p className="text-3xl font-bold text-gray-900">{stats.totalOrders}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-400">
            <p className="text-gray-600 text-sm font-medium">Active Orders</p>
            <p className="text-3xl font-bold text-yellow-600">{stats.activeOrders}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-400">
            <p className="text-gray-600 text-sm font-medium">Completed</p>
            <p className="text-3xl font-bold text-green-600">{stats.completedOrders}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-400">
            <p className="text-gray-600 text-sm font-medium">Cancelled</p>
            <p className="text-3xl font-bold text-red-600">{stats.cancelledOrders}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Orders Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Order History</h2>
            
            {/* Filter Tabs */}
            <div className="flex gap-2">
              {(["all", "active", "completed", "cancelled"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filterStatus === s
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {s === "all"
                    ? "All Orders"
                    : s === "active"
                    ? "Active"
                    : s === "completed"
                    ? "Completed"
                    : "Cancelled"}
                  {s !== "all" && (
                    <span className="ml-2 text-sm">
                      ({stats[`${s}Orders` as keyof RealtorStats]})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Order #</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Type</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Address</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Date</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.orderNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{order.type}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{order.address}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(order.createdAt)}</td>
                    <td className="px-6 py-4 text-sm">
                      <Link
                        href={`/admin/orders/${order.orderNumber}`}
                        className="text-green-600 hover:text-green-700 font-medium transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredOrders.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600">
                  {filterStatus === "all" ? "No orders found" : `No ${filterStatus} orders`}
                </p>
              </div>
            )}
          </div>

          {/* Results count */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
            Showing {filteredOrders.length} of {orders.length} orders
          </div>
        </div>
      </div>
    </div>
  );
}
