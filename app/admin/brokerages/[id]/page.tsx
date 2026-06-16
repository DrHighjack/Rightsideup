"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  paymentMethod: string;
  createdAt: string;
}

interface Brokerage {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  admin: {
    firstName: string;
    lastName: string;
    email: string;
  };
  agents: Agent[];
}

export default function BrokeragePage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const brokerageId = params.id as string;

  const [brokerage, setBrokerage] = useState<Brokerage | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    paymentMethod: "OFFICE",
    password: "",
    confirmPassword: "",
  });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchBrokerage = async () => {
      try {
        const res = await fetch(`/api/admin/brokerages/${brokerageId}`);
        if (!res.ok) throw new Error("Failed to fetch brokerage");
        const data = await res.json();
        setBrokerage(data.brokerage);
      } catch (err) {
        // Handle error silently, form has its own error display
      } finally {
        setLoading(false);
      }
    };

    if (status === "authenticated" && brokerageId) {
      fetchBrokerage();
    }
  }, [status, brokerageId]);

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setFormError("Passwords do not match");
      setFormLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/brokerages/${brokerageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone || undefined,
          paymentMethod: formData.paymentMethod,
          password: formData.password,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add agent");
      }

      // Refresh brokerage data
      const brokerageRes = await fetch(`/api/admin/brokerages/${brokerageId}`);
      const brokerageData = await brokerageRes.json();
      setBrokerage(brokerageData.brokerage);

      // Reset form
      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        phone: "",
        paymentMethod: "OFFICE",
        password: "",
        confirmPassword: "",
      });
      setShowAddAgent(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to add agent");
    } finally {
      setFormLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!brokerage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-8 px-4">
          <p className="text-gray-600">Brokerage not found</p>
          <Link href="/admin/brokerages" className="text-primary hover:underline">
            Back to Brokerages
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <Link href="/admin/brokerages" className="text-primary hover:underline mb-6 inline-block">
          ← Back to Brokerages
        </Link>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{brokerage.name}</h1>
          <div className="grid grid-cols-2 gap-4 text-sm mt-4">
            <div>
              <p className="text-gray-600">Admin</p>
              <p className="text-gray-900 font-medium">
                {brokerage.admin.firstName} {brokerage.admin.lastName}
              </p>
              <p className="text-gray-600">{brokerage.admin.email}</p>
            </div>
            {brokerage.phone && (
              <div>
                <p className="text-gray-600">Phone</p>
                <p className="text-gray-900 font-medium">{brokerage.phone}</p>
              </div>
            )}
            {brokerage.email && (
              <div>
                <p className="text-gray-600">Email</p>
                <p className="text-gray-900 font-medium">{brokerage.email}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Agents ({brokerage.agents.length})</h2>
            <button
              onClick={() => setShowAddAgent(!showAddAgent)}
              className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition"
            >
              {showAddAgent ? "Cancel" : "Add Agent"}
            </button>
          </div>

          {showAddAgent && (
            <form onSubmit={handleAddAgent} className="bg-gray-50 p-6 rounded-md mb-6">
              {formError && (
                <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) =>
                      setFormData({ ...formData, paymentMethod: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value="OFFICE">Office Pays</option>
                    <option value="SELF">Agent Pays</option>
                  </select>
                </div>
                <div></div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                    minLength={8}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, confirmPassword: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                    minLength={8}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="mt-4 bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark transition disabled:opacity-50"
              >
                {formLoading ? "Adding..." : "Add Agent"}
              </button>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Phone</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Payment</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Joined</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {brokerage.agents.map((agent) => (
                  <tr key={agent.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      {agent.firstName} {agent.lastName}
                    </td>
                    <td className="py-3 px-4">{agent.email}</td>
                    <td className="py-3 px-4">{agent.phone || "-"}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          agent.paymentMethod === "OFFICE"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {agent.paymentMethod === "OFFICE" ? "Office Pays" : "Agent Pays"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {new Date(agent.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-3 justify-end">
                        <Link
                          href={`/admin/clients/${agent.id}`}
                          className="text-green-600 hover:text-green-700 text-sm font-medium"
                        >
                          View Profile
                        </Link>
                        <Link
                          href={`/admin/orders/new?realtorId=${agent.id}`}
                          className="text-primary hover:text-primary-dark text-sm font-medium"
                        >
                          Book Order
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {brokerage.agents.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-600">No agents in this brokerage yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
