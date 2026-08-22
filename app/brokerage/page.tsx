"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Script from "next/script";

declare global {
  interface Window {
    Tokenizer?: new (options: {
      url: string;
      apikey: string;
      container: string;
      submission: (response: { status?: string; token?: string; message?: string }) => void;
    }) => { submit?: () => void };
  }
}

const fluidPayPublicKey = process.env.NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY || "";
const fluidPayBaseUrl = process.env.NEXT_PUBLIC_FLUIDPAY_BASE_URL || "https://sandbox.fluidpay.com";

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
  taxAmount: number;
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

interface SavedPaymentMethod {
  id: string;
  last4: string | null;
  nickname: string | null;
}

interface StatementSnapshot {
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    realtorName: string;
    balanceCents: number;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitAmount: number;
      totalAmount: number;
    }>;
  }>;
}

interface BrokerageStatement {
  id: string;
  statementNumber: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: "READY" | "PAYMENT_PENDING" | "PAID" | "FAILED" | "VOIDED";
  totalCents: number;
  paidAt: string | null;
  paymentCardLast4: string | null;
  snapshot: StatementSnapshot;
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
  const linkedStatementId = searchParams.get("statement");

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
  const [statements, setStatements] = useState<BrokerageStatement[]>([]);
  const [savedCards, setSavedCards] = useState<SavedPaymentMethod[]>([]);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [expandedStatementId, setExpandedStatementId] = useState<string | null>(null);
  const [generatingStatement, setGeneratingStatement] = useState(false);
  const [payingStatementId, setPayingStatementId] = useState<string | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [paymentScriptLoaded, setPaymentScriptLoaded] = useState(false);
  const [paymentFormReady, setPaymentFormReady] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [paymentTokenizer, setPaymentTokenizer] = useState<{ submit?: () => void } | null>(null);
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

      const [profileRes, agentsRes, invoicesRes, statementsRes, cardsRes] = await Promise.all([
        fetch("/api/brokerage/profile"),
        fetch("/api/brokerage/agents"),
        fetch(`/api/brokerage/invoices?${query.toString()}`),
        fetch("/api/brokerage/statements"),
        fetch("/api/payments/card-on-file"),
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
      const statementsData = statementsRes.ok ? await statementsRes.json() : { statements: [] };
      const cardsData = cardsRes.ok ? await cardsRes.json() : { cards: [] };
      setBrokerage(profileData.brokerage);
      setAgents(agentsData.agents || []);
      setAgentSummary(agentsData.summary || null);
      setInvoices(invoicesData.invoices || []);
      setInvoiceSummary(invoicesData.summary || null);
      setStatements(statementsData.statements || []);
      setSavedCards(cardsData.cards || []);
      setSelectedCardId((current) => current || cardsData.cards?.[0]?.id || "");
    } catch (err: any) {
      setError(err?.message || "Failed to load brokerage data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [invoiceStatusFilter, invoiceMemberFilter]);

  useEffect(() => {
    if (linkedStatementId && statements.some((statement) => statement.id === linkedStatementId)) {
      setExpandedStatementId(linkedStatementId);
      document.getElementById(`statement-${linkedStatementId}`)?.scrollIntoView({ behavior: "smooth" });
    }
  }, [linkedStatementId, statements]);

  const activeMembers = useMemo(
    () => agents.filter((agent) => !agent.isInactive).length,
    [agents]
  );

  const formatMoney = (amountCents: number) => `$${(amountCents / 100).toFixed(2)}`;

  useEffect(() => {
    if (!paymentScriptLoaded || !addingCard || !window.Tokenizer) return;
    if (!fluidPayPublicKey) {
      setError("FluidPay public key is not configured");
      return;
    }
    const container = document.getElementById("brokerage-payment-form");
    if (!container) return;
    container.replaceChildren();

    const tokenizer = new window.Tokenizer({
      url: fluidPayBaseUrl,
      apikey: fluidPayPublicKey,
      container: "#brokerage-payment-form",
      submission: async (response) => {
        if (response.status !== "success" || !response.token) {
          setError(response.message || "Card tokenization failed");
          setSavingCard(false);
          return;
        }
        try {
          const saveResponse = await fetch("/api/payments/save-card", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: response.token }),
          });
          const data = await saveResponse.json();
          if (!saveResponse.ok) throw new Error(data.error || "Failed to save company card");
          setAddingCard(false);
          await loadData();
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : "Failed to save company card");
        } finally {
          setSavingCard(false);
        }
      },
    });
    setPaymentTokenizer(tokenizer);
    setPaymentFormReady(Boolean(tokenizer.submit));
  }, [addingCard, paymentScriptLoaded]);

  const handleSaveCompanyCard = () => {
    setError("");
    if (!paymentTokenizer?.submit) {
      setError("Payment form is still loading");
      return;
    }
    setSavingCard(true);
    paymentTokenizer.submit();
  };

  const handleGenerateStatement = async () => {
    try {
      setGeneratingStatement(true);
      setError("");
      const response = await fetch("/api/brokerage/statements", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate statement");
      await loadData();
      setExpandedStatementId(data.statement?.id || null);
    } catch (statementError) {
      setError(statementError instanceof Error ? statementError.message : "Failed to generate statement");
    } finally {
      setGeneratingStatement(false);
    }
  };

  const handlePayStatement = async (statementId: string) => {
    if (!selectedCardId) {
      setError("Add or select a company card first");
      return;
    }
    if (!window.confirm("Charge the selected company card for this full statement?")) return;

    try {
      setPayingStatementId(statementId);
      setError("");
      const response = await fetch(`/api/brokerage/statements/${statementId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savedPaymentMethodId: selectedCardId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Statement payment failed");
      await loadData();
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Statement payment failed");
    } finally {
      setPayingStatementId(null);
    }
  };

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
      <div className="space-y-6">
      <Script
        src={`${fluidPayBaseUrl}/tokenizer/tokenizer.js`}
        strategy="afterInteractive"
        onLoad={() => setPaymentScriptLoaded(true)}
        onError={() => setError("Failed to load the secure payment form")}
      />

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Company payment method</h3>
            <p className="mt-1 text-sm text-gray-600">Used only when you approve a monthly statement payment.</p>
          </div>
          <button
            type="button"
            onClick={() => setAddingCard((current) => !current)}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {addingCard ? "Cancel" : "Add company card"}
          </button>
        </div>
        {savedCards.length > 0 && (
          <select
            value={selectedCardId}
            onChange={(event) => setSelectedCardId(event.target.value)}
            className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          >
            {savedCards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.nickname || "Company card"} ending in {card.last4 || "saved"}
              </option>
            ))}
          </select>
        )}
        {savedCards.length === 0 && !addingCard && (
          <p className="text-sm text-orange-700">No company card is saved.</p>
        )}
        {addingCard && (
          <div className="mt-4 max-w-xl space-y-3">
            <div id="brokerage-payment-form" className="min-h-[220px] rounded-md border border-gray-200 p-3" />
            <button
              type="button"
              onClick={handleSaveCompanyCard}
              disabled={savingCard || !paymentFormReady}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {savingCard ? "Saving..." : "Save company card"}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Monthly statements</h3>
            <p className="mt-1 text-sm text-gray-600">Generated automatically on the first day of each month for unpaid member invoices.</p>
          </div>
          <button
            type="button"
            onClick={handleGenerateStatement}
            disabled={generatingStatement}
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {generatingStatement ? "Generating..." : "Generate previous month"}
          </button>
        </div>

        <div className="space-y-3">
          {statements.map((statement) => (
            <div id={`statement-${statement.id}`} key={statement.id} className="scroll-mt-6 border-t border-gray-200 pt-4 first:border-0 first:pt-0">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <button
                  type="button"
                  onClick={() => setExpandedStatementId((current) => current === statement.id ? null : statement.id)}
                  className="text-left"
                >
                  <span className="block font-semibold text-gray-900">{statement.statementNumber}</span>
                  <span className="block text-sm text-gray-600">
                    {new Date(statement.periodStart).toLocaleDateString()} - {new Date(statement.periodEnd).toLocaleDateString()} · {statement.snapshot.invoices.length} invoices
                  </span>
                </button>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statement.status === "PAID" ? "bg-green-100 text-green-800" : statement.status === "FAILED" ? "bg-red-100 text-red-800" : "bg-orange-100 text-orange-800"}`}>
                    {statement.status.replace("_", " ")}
                  </span>
                  <span className="text-lg font-bold text-gray-900">{formatMoney(statement.totalCents)}</span>
                  <a
                    href={`/api/brokerage/statements/${statement.id}/pdf`}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Download PDF
                  </a>
                  {statement.status !== "PAID" && statement.status !== "PAYMENT_PENDING" && (
                    <button
                      type="button"
                      onClick={() => void handlePayStatement(statement.id)}
                      disabled={payingStatementId === statement.id || !selectedCardId}
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {payingStatementId === statement.id ? "Processing..." : "Pay all"}
                    </button>
                  )}
                </div>
              </div>

              {expandedStatementId === statement.id && (
                <div className="mt-4 overflow-x-auto border-t border-gray-100 pt-3">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead className="text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-2 py-2">Invoice / Date</th>
                        <th className="px-2 py-2">Realtor</th>
                        <th className="px-2 py-2">Item</th>
                        <th className="px-2 py-2 text-right">Qty</th>
                        <th className="px-2 py-2 text-right">Rate</th>
                        <th className="px-2 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement.snapshot.invoices.flatMap((invoice) =>
                        invoice.lineItems.map((item, index) => (
                          <tr key={`${invoice.id}-${index}`} className="border-t border-gray-100">
                            <td className="px-2 py-2">
                              <span className="block font-medium text-gray-900">{invoice.invoiceNumber}</span>
                              <span className="text-xs text-gray-500">{new Date(invoice.invoiceDate).toLocaleDateString()}</span>
                            </td>
                            <td className="px-2 py-2 text-gray-700">{invoice.realtorName}</td>
                            <td className="px-2 py-2 text-gray-700">{item.description}</td>
                            <td className="px-2 py-2 text-right">{item.quantity}</td>
                            <td className="px-2 py-2 text-right">{formatMoney(item.unitAmount)}</td>
                            <td className="px-2 py-2 text-right font-medium">{formatMoney(item.totalAmount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          {statements.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-500">No monthly statements yet.</p>
          )}
        </div>
      </section>

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
                <th className="px-2 py-3 text-right">PDF</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const amount = invoice.amount || 0;
                const discount = invoice.discountAmount || 0;
                const paid = invoice.paidAmount || 0;
                const balance = Math.max(0, amount - discount + invoice.taxAmount - paid);
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
                    <td className="px-2 py-3 text-right font-medium text-gray-900">{formatMoney(amount - discount + invoice.taxAmount)}</td>
                    <td className="px-2 py-3 text-right font-medium text-green-700">{formatMoney(paid)}</td>
                    <td className="px-2 py-3 text-right font-medium text-orange-700">{formatMoney(balance)}</td>
                    <td className="px-2 py-3 text-gray-700">
                      {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <a
                        href={`/api/invoices/${invoice.id}/pdf`}
                        className="font-medium text-blue-700 hover:text-blue-900"
                      >
                        Download
                      </a>
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-2 py-8 text-center text-gray-500">
                    No invoices found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      </div>
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
