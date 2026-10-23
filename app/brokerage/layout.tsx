"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MobilePageMenu } from "@/app/components/MobilePageMenu";
import { CreditCardIcon, DocumentIcon, UsersIcon } from "@/app/components/icons";

export default function BrokerageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.push("/login");
      return;
    }

    const role = session.user.role;
    if (role !== "BROKERAGE") {
      if (role === "ADMIN" || role === "SALESMEN") {
        router.push("/admin");
      } else if (role === "FIELD_TECH") {
        router.push("/field/dashboard");
      } else {
        router.push("/dashboard");
      }
    }
  }, [session, status, router]);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  const mobileSections = [{
    title: "Pages",
    items: [
      { href: "/brokerage?tab=members", label: "Members", icon: UsersIcon },
      { href: "/brokerage?tab=billing", label: "Billing", icon: CreditCardIcon },
      { href: "/brokerage/listing-links", label: "Listing Links", icon: DocumentIcon },
    ],
  }];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2 md:px-4 md:py-4">
          <div className="flex min-w-0 items-center gap-3 md:hidden">
            <MobilePageMenu brand="Brokerage Portal" sections={mobileSections} onSignOut={handleSignOut} />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-primary">Brokerage Portal</h1>
              <p className="truncate text-xs text-gray-600">Manage your agents</p>
            </div>
          </div>
          <div className="hidden md:block">
            <h1 className="text-lg font-bold text-primary">Brokerage Portal</h1>
            <p className="text-xs text-gray-600">Manage your brokerage agents</p>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/brokerage?tab=members"
              className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Members
            </Link>
            <Link
              href="/brokerage?tab=billing"
              className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Billing
            </Link>
            <Link href="/brokerage/listing-links" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Listing Links
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-11 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-3 py-4 md:px-4 md:py-6">{children}</main>
    </div>
  );
}
