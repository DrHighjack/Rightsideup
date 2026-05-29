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

interface OrderForm {
  type: "INSTALL" | "REMOVAL" | "CHANGE";
  address: string;
  scheduledDate: string;
  notes: string;
  realtorId: string;
  items: Array<{
    signId?: string;
    quantity: number;
    isHangingSelf?: boolean;
  }>;
}

export default function SalesmenClientsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<"clients" | "create">("clients");
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [allocatingFreeInstall, setAllocatingFreeInstall] = useState<string | null>(null);
  
  // Order form state
  const [orderForm, setOrderForm] = useState<OrderForm>({
    type: "INSTALL",
    address: "",
    scheduledDate: "",
    notes: "",
    realtorId: "",
    items: [{ quantity: 1, isHangingSelf: false }],
  });
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

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

  const handleSubmitOrder = async () => {
    try {
      if (!orderForm.realtorId) {
        setOrderError("Please select a client");
        return;
      }
      if (!orderForm.address.trim()) {
        setOrderError("Address is required");
        return;
      }

      setCreatingOrder(true);
      setOrderError("");

      const res = await fetch("/api/salesmen/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          realtorId: orderForm.realtorId,
          type: orderForm.type,
          address: orderForm.address,
          scheduledDate: orderForm.scheduledDate || undefined,
          notes: orderForm.notes || undefined,
          items: orderForm.items,
          status: "PENDING",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create order");
      }

      const data = await res.json();
      
      // Show success message
      setOrderSuccess(true);
      setSuccessMessage(`Order ${data.orderNumber} created successfully!`);
      
      // Reset form
      setOrderForm({
        type: "INSTALL",
        address: "",
        scheduledDate: "",
        notes: "",
        realtorId: "",
        items: [{ quantity: 1, isHangingSelf: false }],
      });

      // Hide success message after 3 seconds
      setTimeout(() => {
        setOrderSuccess(false);
      }, 3000);
    } catch (err) {
      setOrderError((err as Error).message || "Failed to create order");
    } finally {
      setCreatingOrder(false);
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
            <h1 className="text-3xl font-bold text-gray-900">Manage Clients</h1>
            <p className="text-gray-600 mt-2">Manage clients and create orders</p>
          </div>
          <Link
            href="/admin/salesmen"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => {
              setTab("clients");
              setPage(1);
            }}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              tab === "clients"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            My Clients
          </button>
          <button
            onClick={() => setTab("create")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              tab === "create"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Create Order
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* CLIENTS TAB */}
        {tab === "clients" && (
          <>
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
          </>
        )}

        {/* CREATE ORDER TAB */}
        {tab === "create" && (
          <div className="bg-white rounded-lg shadow p-6">
            {/* Success Message */}
            {orderSuccess && (
              <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-800">
                ✓ {successMessage}
              </div>
            )}

            {/* Error Message */}
            {orderError && (
              <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
                {orderError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div>
                {/* Select Client */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Client *
                  </label>
                  <select
                    value={orderForm.realtorId}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, realtorId: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                  >
                    <option value="">-- Choose a client --</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.firstName} {client.lastName} ({client.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Order Type */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Type *
                  </label>
                  <select
                    value={orderForm.type}
                    onChange={(e) =>
                      setOrderForm({
                        ...orderForm,
                        type: e.target.value as "INSTALL" | "REMOVAL" | "CHANGE",
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                  >
                    <option value="INSTALL">Install</option>
                    <option value="REMOVAL">Removal</option>
                    <option value="CHANGE">Change</option>
                  </select>
                </div>

                {/* Scheduled Date */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    value={orderForm.scheduledDate}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, scheduledDate: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div>
                {/* Address */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address *
                  </label>
                  <input
                    type="text"
                    value={orderForm.address}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, address: e.target.value })
                    }
                    placeholder="Property address"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500"
                  />
                </div>

                {/* Hanging Self */}
                <div className="mb-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={orderForm.items[0]?.isHangingSelf || false}
                      onChange={(e) => {
                        const newItems = [...orderForm.items];
                        newItems[0] = {
                          ...newItems[0],
                          isHangingSelf: e.target.checked,
                        };
                        setOrderForm({ ...orderForm, items: newItems });
                      }}
                      className="rounded border-gray-300 text-blue-600 mr-2"
                    />
                    <span className="text-sm text-gray-700">
                      Customer will hang the sign themselves
                    </span>
                  </label>
                </div>

                {/* Notes */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={orderForm.notes}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, notes: e.target.value })
                    }
                    placeholder="Special instructions or notes..."
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setTab("clients");
                  setOrderForm({
                    type: "INSTALL",
                    address: "",
                    scheduledDate: "",
                    notes: "",
                    realtorId: "",
                    items: [{ quantity: 1, isHangingSelf: false }],
                  });
                }}
                disabled={creatingOrder}
                className="px-6 py-2 rounded border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitOrder}
                disabled={creatingOrder}
                className="px-6 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {creatingOrder ? "Creating..." : "Create Order"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
