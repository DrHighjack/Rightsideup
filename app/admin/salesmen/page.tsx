"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SalesmenDashboard() {
  const { status, data: sessionData } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      const userRole = (sessionData?.user as any)?.role;
      if (!["ADMIN", "SALESMEN"].includes(userRole)) {
        router.push("/login");
      }
    }
  }, [status, router, sessionData]);

  if (status === "loading") {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (status !== "authenticated") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Salesmen Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage clients and allocate free installs</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Manage Clients Card */}
          <Link
            href="/admin/salesmen/clients"
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border-l-4 border-blue-600 cursor-pointer"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-2">Manage Clients</h2>
            <p className="text-gray-600 mb-4">
              View all realtor clients and allocate free installs
            </p>
            <span className="text-blue-600 font-medium">Go to Clients →</span>
          </Link>

          {/* Back to Admin Card */}
          {(sessionData?.user as any)?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border-l-4 border-green-600 cursor-pointer"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-2">Admin Dashboard</h2>
              <p className="text-gray-600 mb-4">
                Access full admin controls and reporting
              </p>
              <span className="text-green-600 font-medium">Go to Admin →</span>
            </Link>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">About Free Installs</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Each client can receive one free install allocation</li>
            <li>• Once allocated, it's tracked in the client's profile</li>
            <li>• Free installs can be revoked if needed</li>
            <li>• This is separate from paid installations</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
