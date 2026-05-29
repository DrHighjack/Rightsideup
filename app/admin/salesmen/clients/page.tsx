"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  brokerageName?: string;
  paymentMethod?: string;
  freeInstallGivenBy?: string;
  freeInstallDate?: string;
  createdAt: string;
  _count: {
    orders: number;
  };
}

export default function SalesmenClientsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [allocatingFreeInstall, setAllocatingFreeInstall] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const fetchClients = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(
          `/api/salesmen/clients?search=${search}&page=${page}&limit=10`
        );

        if (!res.ok) {
          throw new Error("Failed to fetch clients");
        }

        const data = await res.json();
        setClients(data.clients);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } catch (err) {
        setError("Failed to load clients");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [status, search, page]);

  const handleGiveFreeInstall = async (clientId: string, hasInstall: boolean) => {
    try {
      setAllocatingFreeInstall(clientId);
      setError("");

      const method = hasInstall ? "DELETE" : "POST";
      const res = await fetch(
        `/api/salesmen/clients/${clientId}/free-install`,
        { method }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update free install");
      }

      const data = await res.json();

      // Update local state
      setClients(
        clients.map((c) =>
          c.id === clientId
            ? {
                ...c,
                freeInstallGivenBy: data.client.freeInstallGivenBy,
                freeInstallDate: data.client.freeInstallDate,
              }
            : c
        )
      );
    } catch (err) {
      setError((err as Error).message || "Failed to update free install");
    } finally {
      setAllocatingFreeInstall(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (status === "loading" || loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (status !== "authenticated") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Clients</h1>
            <p className="text-gray-600 mt-2">Manage clients you've added and allocate installs</p>
          </div>
          <Link
            href="/admin/salesmen"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by name, email, or brokerage..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-500"
          />
        </div>

        {/* Clients Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                  Brokerage
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                  Orders
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                  Free Install
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                    {client.firstName} {client.lastName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{client.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {client.brokerageName || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                      {client._count.orders}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {client.freeInstallGivenBy ? (
                      <div>
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                          ✓ Allocated
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(client.freeInstallDate!)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-500 text-xs">Not allocated</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button
                      onClick={() =>
                        handleGiveFreeInstall(client.id, !!client.freeInstallGivenBy)
                      }
                      disabled={allocatingFreeInstall === client.id}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        client.freeInstallGivenBy
                          ? "bg-red-100 text-red-700 hover:bg-red-200"
                          : "bg-green-100 text-green-700 hover:bg-green-200"
                      } disabled:opacity-50`}
                    >
                      {allocatingFreeInstall === client.id
                        ? "..."
                        : client.freeInstallGivenBy
                        ? "Revoke"
                        : "Give"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {clients.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-600 text-lg mb-2">No clients added yet</p>
            <p className="text-gray-500 text-sm">
              You'll see clients here after you allocate them a free install
            </p>
          </div>
        )}

        {/* Pagination */}
        <div className="mt-6 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Showing {clients.length === 0 ? 0 : (page - 1) * 10 + 1} to{" "}
            {Math.min(page * 10, total)} of {total} clients
          </p>
          <div className="space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded bg-gray-200 text-gray-700 disabled:opacity-50 hover:bg-gray-300"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded bg-gray-200 text-gray-700 disabled:opacity-50 hover:bg-gray-300"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
