"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

    const role = (session.user as any).role;
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-bold text-primary">Brokerage Portal</h1>
            <p className="text-xs text-gray-600">Manage your brokerage agents</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/brokerage"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Dashboard
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
