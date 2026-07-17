import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import StatusBadge from "@/app/components/StatusBadge";

function buildOrdersWhere(userId: string, role: string | undefined) {
  return role === "REALTOR" ? { realtorId: userId } : {};
}

async function getDashboardData(userId: string, role: string | undefined) {
  const where = buildOrdersWhere(userId, role);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [active, completedThisMonth, pending, recentOrders] = await Promise.all([
    prisma.order.count({
      where: { ...where, status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
    }),
    prisma.order.count({
      where: {
        ...where,
        status: { in: ["COMPLETED", "IN_GROUND"] },
        createdAt: { gte: startOfMonth, lt: startOfNextMonth },
      },
    }),
    prisma.order.count({
      where: { ...where, status: "PENDING" },
    }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        address: true,
        type: true,
        status: true,
        scheduledDate: true,
        createdAt: true,
      },
    }),
  ]);

  return { active, completedThisMonth, pending, recentOrders };
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id as string;
  const role = (session?.user as any)?.role as string | undefined;

  const { active, completedThisMonth, pending, recentOrders } = await getDashboardData(
    userId,
    role
  );

  const realtorName = session?.user?.name || "Realtor";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {realtorName.split(" ")[0]}
        </h1>
        <p className="text-gray-600">Here's what's happening with your orders.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Active Orders", value: active },
          { label: "Completed This Month", value: completedThisMonth },
          { label: "Pending", value: pending },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-slate-200 p-6 shadow-card hover:shadow-card-hover transition-shadow"
          >
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className="text-3xl font-semibold tracking-tight text-slate-900 mt-2">
              {stat.value}
            </p>
          </div>
        ))}
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
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="text-primary hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
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
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-200 px-6 py-4">
          <Link
            href="/dashboard/orders"
            className="text-sm font-medium text-primary hover:text-primary-dark"
          >
            View all orders →
          </Link>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-primary-light rounded-lg border border-primary p-6 text-center">
        <h3 className="text-lg font-semibold text-primary mb-2">Ready to place an order?</h3>
        <Link
          href="/dashboard/orders/new"
          className="inline-block rounded-md bg-primary px-6 py-2 text-white font-medium hover:bg-primary-dark"
        >
          Place New Order
        </Link>
      </div>
    </div>
  );
}
