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
  brokerageName?: string;
}

interface OrderForm {
  type: "INSTALL" | "REMOVAL" | "CHANGE";
  address: string;
  scheduledDate: string;
  notes: string;
  realtorId: string;
  items: Array<{
    quantity: number;
    isHangingSelf?: boolean;
  }>;
}

export default function SalesmenCreateOrderPage() {
  const { status } = useSession();
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderForm, setOrderForm] = useState<OrderForm>({
    type: "INSTALL",
    address: "",
    scheduledDate: "",
    notes: "",
    realtorId: "",
    items: [{ quantity: 1, isHangingSelf: false }],
  });
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Load clients on mount
  useEffect(() => {
    if (status !== "authenticated") return;

    const fetchClients = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/salesmen/clients?limit=1000");
        if (!res.ok) throw new Error("Failed to fetch clients");
        const data = await res.json();
        setClients(data.clients);
      } catch (err) {
        console.error(err);
        setError("Failed to load clients");
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [status]);

  const handleSubmit = async () => {
    try {
      if (!orderForm.realtorId) {
        setError("Please select a client");
        return;
      }
      if (!orderForm.address.trim()) {
        setError("Address is required");
        return;
      }

      setCreatingOrder(true);
      setError("");

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

      setSuccess(true);
      setSuccessMessage(`✓ Order ${data.orderNumber} created successfully!`);

      // Reset form
      setOrderForm({
        type: "INSTALL",
        address: "",
        scheduledDate: "",
        notes: "",
        realtorId: "",
        items: [{ quantity: 1, isHangingSelf: false }],
      });

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push("/admin/salesmen");
      }, 2000);
    } catch (err) {
      setError((err as Error).message || "Failed to create order");
    } finally {
      setCreatingOrder(false);
    }
  };

  if (status === "loading") {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (status !== "authenticated") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Order</h1>
            <p className="text-gray-600 mt-2">Create a new order for one of your clients</p>
          </div>
          <Link
            href="/admin/salesmen"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg shadow p-8">
          {/* Success Message */}
          {success && (
            <div className="mb-6 rounded-md bg-green-50 p-4 text-sm text-green-800 border border-green-200">
              {successMessage}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-800 border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {/* Select Client */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Client *
              </label>
              <select
                value={orderForm.realtorId}
                onChange={(e) =>
                  setOrderForm({ ...orderForm, realtorId: e.target.value })
                }
                disabled={loading}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Choose a client --</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.firstName} {client.lastName} ({client.email})
                  </option>
                ))}
              </select>
              {loading && (
                <p className="text-xs text-gray-500 mt-1">Loading clients...</p>
              )}
            </div>

            {/* Order Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
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
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="INSTALL">Install</option>
                  <option value="REMOVAL">Removal</option>
                  <option value="CHANGE">Change</option>
                </select>
              </div>

              {/* Scheduled Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scheduled Date
                </label>
                <input
                  type="date"
                  value={orderForm.scheduledDate}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, scheduledDate: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address *
              </label>
              <input
                type="text"
                value={orderForm.address}
                onChange={(e) =>
                  setOrderForm({ ...orderForm, address: e.target.value })
                }
                placeholder="Enter property address"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Hanging Self Checkbox */}
            <div>
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
                  className="rounded border-gray-300 text-blue-600 mr-3 cursor-pointer"
                />
                <span className="text-sm text-gray-700">
                  Customer will hang the sign themselves
                </span>
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={orderForm.notes}
                onChange={(e) =>
                  setOrderForm({ ...orderForm, notes: e.target.value })
                }
                placeholder="Add any special instructions or notes..."
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-8 border-t border-gray-200 mt-8">
            <Link
              href="/admin/salesmen"
              className="px-6 py-2 rounded border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              onClick={handleSubmit}
              disabled={creatingOrder || loading}
              className="px-6 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingOrder ? "Creating..." : "Create Order"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
