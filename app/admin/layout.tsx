"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import NotificationBell from "@/app/components/NotificationBell";

function Ticket811Badge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch("/api/admin/811?status=ACTIVE");
        const activeTickets = await res.json();
        const activeCount = Array.isArray(activeTickets) ? activeTickets.length : 0;

        const res2 = await fetch("/api/admin/811?status=NEEDS_REVIEW");
        const reviewTickets = await res2.json();
        const reviewCount = Array.isArray(reviewTickets) ? reviewTickets.length : 0;

        setCount(activeCount + reviewCount);
      } catch (error) {
        console.error("Failed to fetch ticket count:", error);
      }
    }
    fetchCount();
  }, []);

  if (count === 0) return null;

  return (
    <span className="inline-block ml-2 bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded">
      {count}
    </span>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: sessionData } = useSession();
  const userRole = (sessionData?.user as any)?.role;

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  // Restrict access for salesmen to certain pages
  const isSalesmenOnly = userRole === "SALESMEN";
  const isAdmin = userRole === "ADMIN";

  return (
    <div className="flex h-screen flex-col md:flex-row bg-gray-50">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:bg-white md:border-r md:border-gray-200">
        <div className="flex items-center justify-center h-16 border-b border-gray-200 px-4">
          <h1 className="text-lg font-bold text-primary">Admin</h1>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
          <Link
            href="/admin"
            className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
          >
            Dashboard
          </Link>
          {/* Salesmen: Access to Clients and Salesmen */}
          {isSalesmenOnly && (
            <>
              <Link
                href="/admin/salesmen/clients"
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
              >
                Manage Clients
              </Link>
              <Link
                href="/admin/salesmen/orders/new"
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
              >
                Create Order
              </Link>
            </>
          )}
          {/* Admin: Full Access */}
          {isAdmin && (
            <>
              <Link
                href="/admin/orders"
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
              >
                All Orders
              </Link>
              <Link
                href="/admin/orders/map"
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
              >
                Orders Map
              </Link>
              <Link
                href="/admin/orders/new"
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
              >
                Create Order
              </Link>
              <Link
                href="/admin/coupons"
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
              >
                Coupons
              </Link>
              <Link
                href="/admin/brokerages"
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
              >
                Client Management
              </Link>
              <Link
                href="/admin/811"
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
              >
                811 Tickets
                <Ticket811Badge />
              </Link>
              <Link
                href="/admin/jobs"
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
              >
                Jobs
              </Link>
              <Link
                href="/admin/activity"
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
              >
                📋 Activity Log
              </Link>
              <Link
                href="/admin/login-tracking"
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
              >
                🔐 Login Tracking
              </Link>
              <Link
                href="/admin/pricing"
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
              >
                💰 Pricing
              </Link>
              <Link
                href="/admin/analytics"
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
              >
                📈 Analytics
              </Link>
              <Link
                href="/admin/reports"
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
              >
                📊 Reports
              </Link>
              <Link
                href="/admin/leads"
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
              >
                🎁 Lead Responses
              </Link>
              <Link
                href="/admin/inventory"
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
              >
                📦 Inventory
              </Link>
              <Link
                href="/admin/invoices"
                className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
              >
                📄 Invoices
              </Link>
              <div className="pt-4 mt-4 border-t border-gray-200">
                <p className="px-4 py-2 text-xs text-gray-500 uppercase font-semibold">
                  Coming Soon
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-gray-200">
                <Link
                  href="/admin/salesmen"
                  className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
                >
                  👥 Salesmen
                </Link>
                <Link
                  href="/admin/settings"
                  className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
                >
                  ⚙️ Settings
                </Link>
              </div>
            </>
          )}
        </nav>
        <div className="border-t border-gray-200 p-4">
          <button
            onClick={handleSignOut}
            className="w-full rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header with notification bell */}
        <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-3 flex justify-end">
          <NotificationBell />
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
