"use client";

import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import NotificationBell from "@/app/components/NotificationBell";
import {
  HomeIcon,
  OrdersIcon,
  PlusCircleIcon,
  SignpostIcon,
  PackageIcon,
  ShieldIcon,
  CreditCardIcon,
  UserIcon,
  DocumentIcon,
  UsersIcon,
  LogoutIcon,
} from "@/app/components/icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: HomeIcon },
  { href: "/dashboard/orders", label: "My Orders", short: "Orders", icon: OrdersIcon },
  { href: "/dashboard/orders/new", label: "New Order", short: "New", icon: PlusCircleIcon },
  { href: "/dashboard/signs", label: "My Signs", short: "Signs", icon: SignpostIcon },
  { href: "/dashboard/inventory", label: "Inventory", short: "Inv", icon: PackageIcon },
  { href: "/dashboard/811", label: "811 Tracker", short: "811", icon: ShieldIcon },
  { href: "/dashboard/invoices", label: "Invoices", short: "Bills", icon: CreditCardIcon },
  { href: "/dashboard/account", label: "Account", short: "Account", icon: UserIcon },
  { href: "/dashboard/tutorials", label: "Tutorials", short: "Help", icon: DocumentIcon },
];

const MY_AGENTS_ITEM = { href: "/dashboard/my-agents", label: "My Agents", short: "Agents", icon: UsersIcon };

// Highlight only the nav item whose href is the longest prefix of the
// current path, so /dashboard/orders/new lights up "New Order" and not
// also "My Orders" and "Dashboard".
function useActiveHref(items: { href: string }[]): string | undefined {
  const pathname = usePathname() || "";
  let best: string | undefined;
  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      if (!best || item.href.length > best.length) best = item.href;
    }
  }
  return best;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role as string | undefined;
  const isTC = userRole === "TC";

  const navItems = isTC
    ? [...NAV_ITEMS.slice(0, 2), MY_AGENTS_ITEM, ...NAV_ITEMS.slice(2)]
    : NAV_ITEMS;
  const activeHref = useActiveHref(navItems);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  return (
    <div className="flex h-screen flex-col md:flex-row bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-shrink-0 md:flex-col bg-ink border-r border-ink-border">
        <div className="flex items-center gap-2.5 h-16 border-b border-ink-border px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/15 text-primary-400">
            <SignpostIcon className="w-5 h-5" />
          </span>
          <h1 className="text-[15px] font-semibold tracking-tight text-white">
            SignPost <span className="text-primary-400">Field</span>
          </h1>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === activeHref;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary-500/15 text-white"
                    : "text-ink-muted hover:bg-ink-hover hover:text-white"
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? "text-primary-400" : ""}`} />
                {label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-400" />}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-ink-border p-3">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:bg-ink-hover hover:text-white transition-colors"
          >
            <LogoutIcon className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Top header with notification bell */}
        <div className="bg-white/80 backdrop-blur border-b border-slate-200 px-4 md:px-8 py-2.5 flex justify-end">
          <NotificationBell />
        </div>
        <div className="flex-1 p-4 md:p-8">
          {children}
        </div>

        {/* Mobile bottom nav */}
        <nav className="md:hidden border-t border-slate-200 bg-white flex px-1 py-1.5 overflow-x-auto">
          {navItems.map(({ href, short, icon: Icon }) => {
            const active = href === activeHref;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
                  active ? "text-primary-600" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Icon className="w-5 h-5" />
                {short}
              </Link>
            );
          })}
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
