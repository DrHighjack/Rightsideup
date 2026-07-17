"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, type ComponentType } from "react";
import NotificationBell from "@/app/components/NotificationBell";
import {
  HomeIcon,
  OrdersIcon,
  PlusCircleIcon,
  MapIcon,
  WrenchIcon,
  ShieldIcon,
  UsersIcon,
  TagIcon,
  BriefcaseIcon,
  CreditCardIcon,
  CurrencyIcon,
  PackageIcon,
  ChartIcon,
  DocumentIcon,
  ActivityIcon,
  LockIcon,
  SettingsIcon,
  SignpostIcon,
  LogoutIcon,
} from "@/app/components/icons";

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
    <span className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
      {count}
    </span>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: ComponentType;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const ADMIN_NAV: NavGroup[] = [
  {
    title: "Orders & Jobs",
    items: [
      { href: "/admin/orders", label: "All Orders", icon: OrdersIcon },
      { href: "/admin/orders/map", label: "Orders Map", icon: MapIcon },
      { href: "/admin/orders/new", label: "Create Order", icon: PlusCircleIcon },
      { href: "/admin/jobs", label: "Jobs", icon: WrenchIcon },
      { href: "/admin/811", label: "811 Tickets", icon: ShieldIcon, badge: Ticket811Badge },
    ],
  },
  {
    title: "Clients & Sales",
    items: [
      { href: "/admin/brokerages", label: "Client Management", icon: UsersIcon },
      { href: "/admin/leads", label: "Lead Responses", icon: TagIcon },
      { href: "/admin/salesmen", label: "Salesmen", icon: BriefcaseIcon },
      { href: "/admin/coupons", label: "Coupons", icon: TagIcon },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/admin/invoices", label: "Invoices", icon: CreditCardIcon },
      { href: "/admin/pricing", label: "Pricing", icon: CurrencyIcon },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/inventory", label: "Inventory", icon: PackageIcon },
      { href: "/admin/analytics", label: "Analytics", icon: ChartIcon },
      { href: "/admin/reports", label: "Reports", icon: DocumentIcon },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/activity", label: "Activity Log", icon: ActivityIcon },
      { href: "/admin/login-tracking", label: "Login Tracking", icon: LockIcon },
      { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

const SALESMEN_NAV: NavItem[] = [
  { href: "/admin/salesmen/clients", label: "Manage Clients", icon: UsersIcon },
  { href: "/admin/salesmen/orders/new", label: "Create Order", icon: PlusCircleIcon },
];

function useActiveHref(hrefs: string[]): string | undefined {
  const pathname = usePathname() || "";
  let best: string | undefined;
  for (const href of hrefs) {
    if (pathname === href || pathname.startsWith(href + "/")) {
      if (!best || href.length > best.length) best = href;
    }
  }
  return best;
}

function SidebarLink({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  const Icon = item.icon;
  const Badge = item.badge;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-primary-500/15 text-white"
          : "text-ink-muted hover:bg-ink-hover hover:text-white"
      }`}
    >
      <Icon className={`w-5 h-5 shrink-0 ${active ? "text-primary-400" : ""}`} />
      {item.label}
      {Badge ? <Badge /> : active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-400" />}
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

  const isSalesmenOnly = userRole === "SALESMEN";
  const isAdmin = userRole === "ADMIN";

  const allHrefs = [
    "/admin",
    ...(isAdmin ? ADMIN_NAV.flatMap((g) => g.items.map((i) => i.href)) : []),
    ...(isSalesmenOnly ? SALESMEN_NAV.map((i) => i.href) : []),
  ];
  const activeHref = useActiveHref(allHrefs);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  return (
    <div className="flex h-screen flex-col md:flex-row bg-slate-50">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col bg-ink border-r border-ink-border">
        <div className="flex items-center gap-2.5 h-16 border-b border-ink-border px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/15 text-primary-400">
            <SignpostIcon className="w-5 h-5" />
          </span>
          <h1 className="text-[15px] font-semibold tracking-tight text-white">
            SignPost <span className="text-primary-400">Admin</span>
          </h1>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarLink
            item={{ href: "/admin", label: "Dashboard", icon: HomeIcon }}
            active={activeHref === "/admin"}
          />

          {isSalesmenOnly &&
            SALESMEN_NAV.map((item) => (
              <SidebarLink key={item.href} item={item} active={activeHref === item.href} />
            ))}

          {isAdmin &&
            ADMIN_NAV.map((group) => (
              <div key={group.title} className="pt-5">
                <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                  {group.title}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <SidebarLink key={item.href} item={item} active={activeHref === item.href} />
                  ))}
                </div>
              </div>
            ))}
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header with notification bell */}
        <div className="bg-white/80 backdrop-blur border-b border-slate-200 px-4 md:px-8 py-2.5 flex justify-end">
          <NotificationBell />
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
