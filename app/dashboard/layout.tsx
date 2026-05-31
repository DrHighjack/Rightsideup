"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NotificationBell from "@/app/components/NotificationBell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  return (
    <div className="flex h-screen flex-col md:flex-row bg-gray-50">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:bg-white md:border-r md:border-gray-200">
        <div className="flex items-center justify-center h-16 border-b border-gray-200 px-4">
          <h1 className="text-lg font-bold text-primary">SignPost Field</h1>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
          <Link
            href="/dashboard"
            className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard/orders"
            className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
          >
            My Orders
          </Link>
          <Link
            href="/dashboard/orders/new"
            className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
          >
            New Order
          </Link>
          <Link
            href="/dashboard/signs"
            className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
          >
            My Signs
          </Link>
          <Link
            href="/dashboard/811"
            className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
          >
            811 Tracker
          </Link>
          <Link
            href="/dashboard/account"
            className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
          >
            Account
          </Link>
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

        {/* Mobile bottom nav */}
        <nav className="md:hidden border-t border-gray-200 bg-white flex gap-1 px-2 py-2">
          <Link
            href="/dashboard"
            className="flex-1 px-3 py-2 text-center text-xs font-medium text-gray-700 hover:text-primary"
          >
            Home
          </Link>
          <Link
            href="/dashboard/orders"
            className="flex-1 px-3 py-2 text-center text-xs font-medium text-gray-700 hover:text-primary"
          >
            Orders
          </Link>
          <Link
            href="/dashboard/signs"
            className="flex-1 px-3 py-2 text-center text-xs font-medium text-gray-700 hover:text-primary"
          >
            Signs
          </Link>
          <Link
            href="/dashboard/811"
            className="flex-1 px-3 py-2 text-center text-xs font-medium text-gray-700 hover:text-primary"
          >
            811
          </Link>
          <Link
            href="/dashboard/account"
            className="flex-1 px-3 py-2 text-center text-xs font-medium text-gray-700 hover:text-primary"
          >
            Account
          </Link>
        </nav>
      </div>
    </div>
  );
}
