"use client";

import { useEffect, useRef, useState } from "react";
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
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-navy-50">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:bg-white md:border-r md:border-slate-200">
        <div className="flex items-center justify-center h-16 border-b border-slate-200 px-4">
          <h1 className="font-display text-lg font-semibold tracking-tight text-navy-900">SignPost Field</h1>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
          <Link
            href="/dashboard/orders/new"
            className="block rounded-lg border border-green-300 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100"
          >
            + New Order
          </Link>
          <Link
            href="/dashboard"
            className="block rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-navy-50 hover:text-navy-900"
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard/orders"
            className="block rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-navy-50 hover:text-navy-900"
          >
            My Orders
          </Link>
          <Link
            href="/dashboard/inventory"
            className="block rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-navy-50 hover:text-navy-900"
          >
            Inventory
          </Link>
          <Link
            href="/dashboard/811"
            className="block rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-navy-50 hover:text-navy-900"
          >
            811 Tracker
          </Link>
          <Link
            href="/dashboard/invoices"
            className="block rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-navy-50 hover:text-navy-900"
          >
            💳 Invoices
          </Link>
          <Link
            href="/dashboard/account"
            className="block rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-navy-50 hover:text-navy-900"
          >
            Account
          </Link>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top header with notification bell */}
        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-3 flex justify-end items-center gap-3">
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => setAccountMenuOpen((prev) => !prev)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Account
            </button>

            {accountMenuOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded-lg border border-slate-200 bg-white shadow-lg z-50">
                <Link
                  href="/dashboard/account"
                  onClick={() => setAccountMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
          <NotificationBell />
        </div>
        <div className="flex-1 p-4 md:p-8">
          {children}
        </div>

        {/* Mobile bottom nav */}
        <nav className="md:hidden border-t border-slate-200 bg-white flex gap-1 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] overflow-x-auto">
          <Link
            href="/dashboard"
            className="flex min-h-12 flex-1 items-center justify-center rounded-lg px-3 text-center text-xs font-medium text-slate-500 whitespace-nowrap transition-colors hover:text-navy-900"
          >
            Home
          </Link>
          <Link
            href="/dashboard/orders"
            className="flex min-h-12 flex-1 items-center justify-center rounded-lg px-3 text-center text-xs font-medium text-slate-500 whitespace-nowrap transition-colors hover:text-navy-900"
          >
            Orders
          </Link>
          <Link
            href="/dashboard/inventory"
            className="flex min-h-12 flex-1 items-center justify-center rounded-lg px-3 text-center text-xs font-medium text-slate-500 whitespace-nowrap transition-colors hover:text-navy-900"
          >
            📦 Inv
          </Link>
          <Link
            href="/dashboard/811"
            className="flex min-h-12 flex-1 items-center justify-center rounded-lg px-3 text-center text-xs font-medium text-slate-500 whitespace-nowrap transition-colors hover:text-navy-900"
          >
            811
          </Link>
          <Link
            href="/dashboard/invoices"
            className="flex min-h-12 flex-1 items-center justify-center rounded-lg px-3 text-center text-xs font-medium text-slate-500 whitespace-nowrap transition-colors hover:text-navy-900"
          >
            💳 Inv
          </Link>
          <Link
            href="/dashboard/account"
            className="flex min-h-12 flex-1 items-center justify-center rounded-lg px-3 text-center text-xs font-medium text-slate-500 whitespace-nowrap transition-colors hover:text-navy-900"
          >
            Account
          </Link>
        </nav>

        {/* Compliance Footer */}
        <footer className="bg-white border-t border-slate-200 px-4 py-6 text-center text-xs text-slate-500 space-y-2">
          <div className="font-medium text-slate-700">North Shore Sign Co</div>
          <div>6189 NE Radford Dr Apt 1911, Seattle WA 98115 · <a href="tel:2066596323" className="hover:underline">(206) 659-6323</a> · <a href="mailto:billing@northshoresignco.com" className="hover:underline">billing@northshoresignco.com</a></div>
          <div className="text-slate-400">Hosted by Vercel Inc. · 340 Pine Street, San Francisco, CA 94104</div>
          <div className="flex items-center justify-center gap-1 font-medium text-green-700">
            <span>🔒</span>
            <span>All transactions secured with 256-bit SSL encryption</span>
          </div>
          {/* Card brand badges */}
          <div className="flex items-center justify-center gap-3 py-1">
            <span className="inline-flex items-center px-2 py-1 rounded border border-slate-300 bg-slate-50 text-xs font-bold text-blue-800 tracking-wide">VISA</span>
            <span className="inline-flex items-center px-2 py-1 rounded border border-slate-300 bg-slate-50 text-xs font-bold text-red-700 tracking-wide">MC</span>
            <span className="inline-flex items-center px-2 py-1 rounded border border-slate-300 bg-slate-50 text-xs font-bold text-blue-600 tracking-wide">AMEX</span>
          </div>
          <div className="flex justify-center gap-4">
            <Link href="/terms" className="hover:underline">Terms &amp; Conditions</Link>
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link href="/refund" className="hover:underline">Refund Policy</Link>
            <Link href="/contact" className="hover:underline">Contact</Link>
          </div>
          <div className="text-slate-400">&copy; {new Date().getFullYear()} North Shore Sign Co. All rights reserved.</div>
        </footer>

      </div>
    </div>
  );
}
