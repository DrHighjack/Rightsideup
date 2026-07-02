"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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
  isInactive: boolean;
  invoiceCount: number;
  totalAmount: number;
  totalPaid: number;
  outstanding: number;
  overdueCount: number;
  createdAt: string;
}

interface AgentSummary {
  memberCount: number;
  activeCount: number;
  invoiceCount: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  totalOverdue: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  amount: number | null;
  discountAmount: number | null;
  paidAmount: number | null;
  status: "DRAFT" | "SENT" | "VIEWED" | "PAID" | "VOIDED" | "OVERDUE";
  dueDate: string | null;
  createdAt: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface InvoiceSummary {
  invoiceCount: number;
  totalInvoiced: number;
  totalDiscount: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueCount: number;
}

const invoiceStatusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  VIEWED: "bg-indigo-100 text-indigo-700",
  PAID: "bg-green-100 text-green-700",
  VOIDED: "bg-red-100 text-red-700",
  OVERDUE: "bg-orange-100 text-orange-700",
};

function BrokerageDashboardContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "billing" ? "billing" : "members";

  const [brokerage, setBrokerage] = useState<BrokerageProfile | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentSummary, setAgentSummary] = useState<AgentSummary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceSummary, setInvoiceSummary] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("");
  const [invoiceMemberFilter, setInvoiceMemberFilter] = useState("");
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

      const query = new URLSearchParams({
        limit: "25",
      });
      if (invoiceStatusFilter) {
        query.set("status", invoiceStatusFilter);
      }
      if (invoiceMemberFilter) {
        query.set("memberId", invoiceMemberFilter);
      }

      const [profileRes, agentsRes, invoicesRes] = await Promise.all([
        fetch("/api/brokerage/profile"),
        fetch("/api/brokerage/agents"),
        fetch(`/api/brokerage/invoices?${query.toString()}`),
      ]);

      if (!profileRes.ok) {
        const data = await profileRes.json();
        throw new Error(data.error || "Failed to load brokerage profile");
      }

      if (!agentsRes.ok) {
        const data = await agentsRes.json();
        throw new Error(data.error || "Failed to load agents");
      }

      if (!invoicesRes.ok) {
        const data = await invoicesRes.json();
        throw new Error(data.error || "Failed to load invoices");
      }

      const profileData = await profileRes.json();
      const agentsData = await agentsRes.json();
      const invoicesData = await invoicesRes.json();
      setBrokerage(profileData.brokerage);
      setAgents(agentsData.agents || []);
      setAgentSummary(agentsData.summary || null);
      setInvoices(invoicesData.invoices || []);
      setInvoiceSummary(invoicesData.summary || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load brokerage data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [invoiceStatusFilter, invoiceMemberFilter]);

  const activeMembers = useMemo(
    () => agents.filter((agent) => !agent.isInactive).length,
    [agents]
  );

  const formatMoney = (amount: number) => `$${amount.toFixed(2)}`;

  const countOpenInvoices = useMemo(() => {
    return invoices.filter((invoice) => ["SENT", "VIEWED", "OVERDUE", "DRAFT"].includes(invoice.status)).length;
  }, [invoices]);

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
      await loadData();
    } catch (_error) {
      setError("Failed to add agent");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentMethodChange = async (
    agentId: string,
    paymentMethod: "OFFICE" | "SELF"
  ) => {
    try {
      setMemberActionId(agentId);
      const res = await fetch("/api/brokerage/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, paymentMethod }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update payment method");
        return;
      }

      setAgents((prev) =>
        prev.map((agent) =>
          agent.id === agentId
            ? {
                ...agent,
                paymentMethod,
              }
            : agent
        )
      );
    } catch (_err) {
      setError("Failed to update payment method");
    } finally {
      setMemberActionId(null);
    }
  };

  const handleToggleInactive = async (agent: Agent) => {
    const actionLabel = agent.isInactive ? "reactivate" : "deactivate";
    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} ${agent.firstName} ${agent.lastName}?`
    );
    if (!confirmed) {
      return;
    }

    try {
      setMemberActionId(agent.id);
      const res = await fetch("/api/brokerage/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          inactive: !agent.isInactive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Failed to ${actionLabel} member`);
        return;
      }

      await loadData();
    } catch (_err) {
      setError(`Failed to ${actionLabel} member`);
    } finally {
      setMemberActionId(null);
    }
  };

  if (loading) {
    return <div className="py-10 text-center text-gray-600">Loading brokerage portal...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/brokerage?tab=members"
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              activeTab === "members"
                ? "bg-green-600 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Members
          </Link>
          <Link
            href="/brokerage?tab=billing"
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              activeTab === "billing"
                ? "bg-green-600 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Billing
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-2xl font-bold text-gray-900">{brokerage?.name || "My Brokerage"}</h2>
        <p className="mt-1 text-sm text-gray-600">Brokerage profile, member management, and billing overview</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Members</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{agentSummary?.memberCount ?? brokerage?.agentCount ?? 0}</p>
            <p className="mt-1 text-xs text-gray-600">{activeMembers} active</p>
          </div>
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Outstanding Balance</p>
            <p className="mt-1 text-lg font-semibold text-orange-700">{formatMoney(invoiceSummary?.totalOutstanding ?? 0)}</p>
            <p className="mt-1 text-xs text-gray-600">Across all member invoices</p>
          </div>
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Total Paid</p>
            <p className="mt-1 text-lg font-semibold text-green-700">{formatMoney(invoiceSummary?.totalPaid ?? 0)}</p>
            <p className="mt-1 text-xs text-gray-600">Collected invoice payments</p>
          </div>
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Open Invoices</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{countOpenInvoices}</p>
            <p className="mt-1 text-xs text-gray-600">Overdue: {invoiceSummary?.overdueCount ?? 0}</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {activeTab === "members" && (
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">People In Brokerage</h3>
          <button
            type="button"
            onClick={() => setShowAddAgent((prev) => !prev)}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            {showAddAgent ? "Cancel" : "Add New Agent"}
          </button>
        </div>

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
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3">Payment</th>
                <th className="px-2 py-3">Outstanding</th>
                <th className="px-2 py-3">Invoices</th>
                <th className="px-2 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="border-b border-gray-100">
                  <td className="px-2 py-3">{agent.firstName} {agent.lastName}</td>
                  <td className="px-2 py-3">{agent.email}</td>
                  <td className="px-2 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        agent.isInactive
                          ? "bg-gray-200 text-gray-700"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {agent.isInactive ? "Inactive" : "Active"}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <select
                      value={agent.paymentMethod}
                      onChange={(e) =>
                        handlePaymentMethodChange(
                          agent.id,
                          e.target.value as "OFFICE" | "SELF"
                        )
                      }
                      disabled={memberActionId === agent.id}
                      className="rounded border border-gray-300 px-2 py-1"
                    >
                      <option value="OFFICE">Office Pays</option>
                      <option value="SELF">Agent Pays</option>
                    </select>
                  </td>
                  <td className="px-2 py-3 text-orange-700 font-semibold">{formatMoney(agent.outstanding)}</td>
                  <td className="px-2 py-3">
                    {agent.invoiceCount}
                    {agent.overdueCount > 0 ? (
                      <span className="ml-2 text-xs text-orange-700">({agent.overdueCount} overdue)</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleInactive(agent)}
                      disabled={memberActionId === agent.id}
                      className={`rounded px-3 py-1 text-xs font-semibold text-white ${
                        agent.isInactive
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "bg-gray-700 hover:bg-gray-800"
                      } disabled:opacity-50`}
                    >
                      {agent.isInactive ? "Reactivate" : "Deactivate"}
                    </button>
                  </td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-8 text-center text-gray-500">
                    No agents yet. Add your first agent.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeTab === "billing" && (
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-semibold text-gray-900">Brokerage Invoices</h3>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={invoiceMemberFilter}
              onChange={(e) => setInvoiceMemberFilter(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All Members</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.firstName} {agent.lastName}
                </option>
              ))}
            </select>
            <select
              value={invoiceStatusFilter}
              onChange={(e) => setInvoiceStatusFilter(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="SENT">Sent</option>
              <option value="VIEWED">Viewed</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="DRAFT">Draft</option>
              <option value="VOIDED">Voided</option>
            </select>
          </div>
        </div>

        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Total Invoiced</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">{formatMoney(invoiceSummary?.totalInvoiced ?? 0)}</p>
          </div>
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Total Paid</p>
            <p className="mt-1 text-xl font-semibold text-green-700">{formatMoney(invoiceSummary?.totalPaid ?? 0)}</p>
          </div>
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Outstanding</p>
            <p className="mt-1 text-xl font-semibold text-orange-700">{formatMoney(invoiceSummary?.totalOutstanding ?? 0)}</p>
          </div>
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Invoice Count</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">{invoiceSummary?.invoiceCount ?? 0}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-700">
                <th className="px-2 py-3">Invoice</th>
                <th className="px-2 py-3">Member</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3 text-right">Amount</th>
                <th className="px-2 py-3 text-right">Paid</th>
                <th className="px-2 py-3 text-right">Balance</th>
                <th className="px-2 py-3">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const amount = invoice.amount || 0;
                const discount = invoice.discountAmount || 0;
                const paid = invoice.paidAmount || 0;
                const balance = Math.max(0, amount - discount - paid);
                return (
                  <tr key={invoice.id} className="border-b border-gray-100">
                    <td className="px-2 py-3 font-mono text-xs text-gray-900">
                      {invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8).toUpperCase()}`}
                    </td>
                    <td className="px-2 py-3">
                      <p className="font-medium text-gray-900">{invoice.user.firstName} {invoice.user.lastName}</p>
                      <p className="text-xs text-gray-600">{invoice.user.email}</p>
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          invoiceStatusColors[invoice.status] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right font-medium text-gray-900">{formatMoney(amount)}</td>
                    <td className="px-2 py-3 text-right font-medium text-green-700">{formatMoney(paid)}</td>
                    <td className="px-2 py-3 text-right font-medium text-orange-700">{formatMoney(balance)}</td>
                    <td className="px-2 py-3 text-gray-700">
                      {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "-"}
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-8 text-center text-gray-500">
                    No invoices found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </div>
  );
}

export default function BrokerageDashboardPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-gray-600">Loading brokerage portal...</div>}>
      <BrokerageDashboardContent />
    </Suspense>
  );
}
