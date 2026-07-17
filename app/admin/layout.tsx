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
        const [activeTickets, reviewTickets] = await Promise.all([
          fetch("/api/admin/811?status=ACTIVE").then((r) => r.json()),
          fetch("/api/admin/811?status=NEEDS_REVIEW").then((r) => r.json()),
        ]);
        const activeCount = Array.isArray(activeTickets) ? activeTickets.length : 0;
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

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-3 first:pt-0">
      <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </p>
      {children}
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
    >
      {children}
    </Link>
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
              <NavSection title="Orders & Jobs">
                <NavLink href="/admin/orders">All Orders</NavLink>
                <NavLink href="/admin/orders/map">Orders Map</NavLink>
                <NavLink href="/admin/orders/new">Create Order</NavLink>
                <NavLink href="/admin/jobs">Jobs</NavLink>
                <Link
                  href="/admin/811"
                  className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
                >
                  811 Tickets
                  <Ticket811Badge />
                </Link>
              </NavSection>

              <NavSection title="Clients & Sales">
                <NavLink href="/admin/brokerages">Client Management</NavLink>
                <NavLink href="/admin/leads">Lead Responses</NavLink>
                <NavLink href="/admin/salesmen">Salesmen</NavLink>
                <NavLink href="/admin/coupons">Coupons</NavLink>
              </NavSection>

              <NavSection title="Finance">
                <NavLink href="/admin/invoices">Invoices</NavLink>
                <NavLink href="/admin/pricing">Pricing</NavLink>
              </NavSection>

              <NavSection title="Operations">
                <NavLink href="/admin/inventory">Inventory</NavLink>
                <NavLink href="/admin/analytics">Analytics</NavLink>
                <NavLink href="/admin/reports">Reports</NavLink>
              </NavSection>

              <NavSection title="System">
                <NavLink href="/admin/activity">Activity Log</NavLink>
                <NavLink href="/admin/login-tracking">Login Tracking</NavLink>
                <NavLink href="/admin/settings">Settings</NavLink>
              </NavSection>
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
