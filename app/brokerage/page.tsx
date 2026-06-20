"use client";

import { FormEvent, useEffect, useState } from "react";

interface BrokerageProfile {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  billingType: "AGENT" | "BROKERAGE";
  basePriceCents?: number | null;
  agentCount: number;
}

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  paymentMethod: "OFFICE" | "SELF";
  createdAt: string;
}

export default function BrokerageDashboardPage() {
  const [brokerage, setBrokerage] = useState<BrokerageProfile | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    paymentMethod: "OFFICE" as "OFFICE" | "SELF",
    password: "",
    confirmPassword: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [profileRes, agentsRes] = await Promise.all([
        fetch("/api/brokerage/profile"),
        fetch("/api/brokerage/agents"),
      ]);

      if (!profileRes.ok) {
        const data = await profileRes.json();
        throw new Error(data.error || "Failed to load brokerage profile");
      }

      if (!agentsRes.ok) {
        const data = await agentsRes.json();
        throw new Error(data.error || "Failed to load agents");
      }

      const profileData = await profileRes.json();
      const agentsData = await agentsRes.json();
      setBrokerage(profileData.brokerage);
      setAgents(agentsData.agents || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load brokerage data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddAgent = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/brokerage/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone || undefined,
          paymentMethod: formData.paymentMethod,
          password: formData.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add agent");
        return;
      }

      setAgents((prev) => [data.agent, ...prev]);
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        paymentMethod: "OFFICE",
        password: "",
        confirmPassword: "",
      });
      setShowAddAgent(false);
      setBrokerage((prev) =>
        prev
          ? {
              ...prev,
              agentCount: prev.agentCount + 1,
            }
          : prev
      );
    } catch (_error) {
      setError("Failed to add agent");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="py-10 text-center text-gray-600">Loading brokerage portal...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-2xl font-bold text-gray-900">{brokerage?.name || "My Brokerage"}</h2>
        <p className="mt-1 text-sm text-gray-600">Brokerage account dashboard</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Agents</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{brokerage?.agentCount ?? 0}</p>
          </div>
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Billing Type</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{brokerage?.billingType || "-"}</p>
          </div>
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Base Price</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {brokerage?.basePriceCents == null ? "Standard" : `$${(brokerage.basePriceCents / 100).toFixed(2)}`}
            </p>
          </div>
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Contact</p>
            <p className="mt-1 truncate text-sm font-semibold text-gray-900">{brokerage?.email || "Not set"}</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">Brokerage Agents</h3>
          <button
            type="button"
            onClick={() => setShowAddAgent((prev) => !prev)}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            {showAddAgent ? "Cancel" : "Add New Agent"}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {showAddAgent && (
          <form onSubmit={handleAddAgent} className="mb-6 grid gap-4 rounded-md bg-gray-50 p-4 sm:grid-cols-2">
            <input
              type="text"
              placeholder="First name"
              value={formData.firstName}
              onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2"
              required
            />
            <input
              type="text"
              placeholder="Last name"
              value={formData.lastName}
              onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2"
              required
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2"
            />
            <select
              value={formData.paymentMethod}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, paymentMethod: e.target.value as "OFFICE" | "SELF" }))
              }
              className="rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="OFFICE">Office Pays</option>
              <option value="SELF">Agent Pays</option>
            </select>
            <div />
            <input
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2"
              minLength={8}
              required
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2"
              minLength={8}
              required
            />
            <button
              type="submit"
              disabled={submitting}
              className="sm:col-span-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {submitting ? "Adding Agent..." : "Create Agent"}
            </button>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-700">
                <th className="px-2 py-3">Name</th>
                <th className="px-2 py-3">Email</th>
                <th className="px-2 py-3">Phone</th>
                <th className="px-2 py-3">Payment</th>
                <th className="px-2 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="border-b border-gray-100">
                  <td className="px-2 py-3">{agent.firstName} {agent.lastName}</td>
                  <td className="px-2 py-3">{agent.email}</td>
                  <td className="px-2 py-3">{agent.phone || "-"}</td>
                  <td className="px-2 py-3">{agent.paymentMethod === "OFFICE" ? "Office Pays" : "Agent Pays"}</td>
                  <td className="px-2 py-3">{new Date(agent.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-8 text-center text-gray-500">
                    No agents yet. Add your first agent.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
