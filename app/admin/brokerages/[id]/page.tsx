"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import GoogleMapReact from "google-map-react";
import { sendAdminPasswordReset } from "@/lib/admin-password-reset";
import { isOutstandingInvoiceStatus } from "@/lib/invoice-totals";

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
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  billingType: "AGENT" | "BROKERAGE";
  basePriceCents?: number | null;
  autoInvoiceStatus: "DISABLED" | "PENDING" | "APPROVED" | "DENIED";
  autoInvoiceInterval: "MONTHLY" | "BIWEEKLY" | null;
  autoInvoiceRequestedAt: string | null;
  autoInvoiceApprovedAt: string | null;
  autoInvoiceNextRunAt: string | null;
  isActive: boolean;
  admin: {
    firstName: string;
    lastName: string;
    email: string;
  };
  agents: Agent[];
}

interface BrokerageInvoice {
  id: string;
  invoiceNumber: string | null;
  amount: number | null;
  discountAmount: number | null;
  taxAmount: number;
  paidAmount: number | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string };
}

interface BrokerageOrder {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  address: string;
  addressLat: number | null;
  addressLng: number | null;
  createdAt: string;
  scheduledDate: string | null;
  realtor: { id: string; firstName: string; lastName: string; email: string };
}

interface BrokerageStats {
  lifetimeInvoiceTotal: number;
  lifetimePaidTotal: number;
  outstandingBalance: number;
  outstandingInvoiceCount: number;
  lifetimeInvoiceCount: number;
  totalOrders: number;
  pendingOrderCount: number;
  mappedPostCount: number;
}

interface RealtorImportResult {
  created: number;
  emailsSent: number;
  failed: number;
  results: Array<{ rowNumber: number; error: string }>;
}

const emptyStats: BrokerageStats = {
  lifetimeInvoiceTotal: 0,
  lifetimePaidTotal: 0,
  outstandingBalance: 0,
  outstandingInvoiceCount: 0,
  lifetimeInvoiceCount: 0,
  totalOrders: 0,
  pendingOrderCount: 0,
  mappedPostCount: 0,
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    SCHEDULED: "bg-blue-100 text-blue-800",
    ON_HOLD: "bg-orange-100 text-orange-800",
    IN_PROGRESS: "bg-purple-100 text-purple-800",
    IN_GROUND: "bg-cyan-100 text-cyan-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
};

const getMarkerColor = (status: string) => {
  const colors: Record<string, string> = {
    PENDING: "#f59e0b",
    SCHEDULED: "#2563eb",
    ON_HOLD: "#ea580c",
    IN_PROGRESS: "#9333ea",
    IN_GROUND: "#0891b2",
    COMPLETED: "#16a34a",
    CANCELLED: "#dc2626",
  };
  return colors[status] || "#64748b";
};

function OrderMarker({ order, selected, onClick }: {
  order: BrokerageOrder;
  selected: boolean;
  onClick: () => void;
  lat?: number;
  lng?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${order.orderNumber} - ${order.address}`}
      className="block h-6 w-6 rounded-full border-2 border-white shadow-md transition-transform hover:scale-110"
      style={{
        backgroundColor: getMarkerColor(order.status),
        boxShadow: selected ? "0 0 0 4px rgba(15, 23, 42, 0.45)" : undefined,
      }}
    />
  );
}

export default function BrokeragePage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const brokerageId = params.id as string;

  const [brokerage, setBrokerage] = useState<Brokerage | null>(null);
  const [invoices, setInvoices] = useState<BrokerageInvoice[]>([]);
  const [pendingOrders, setPendingOrders] = useState<BrokerageOrder[]>([]);
  const [mappedOrders, setMappedOrders] = useState<BrokerageOrder[]>([]);
  const [stats, setStats] = useState<BrokerageStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [officeLocationStatus, setOfficeLocationStatus] = useState<"idle" | "loading" | "found" | "not-found">("idle");
  const [editForm, setEditForm] = useState({
    name: "",
    address: "",
    email: "",
    phone: "",
    billingType: "AGENT" as "AGENT" | "BROKERAGE",
    basePrice: "",
    isActive: true,
  });
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
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvError, setCsvError] = useState("");
  const [csvResult, setCsvResult] = useState<RealtorImportResult | null>(null);
  const [scheduleInterval, setScheduleInterval] = useState<"MONTHLY" | "BIWEEKLY">("MONTHLY");
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const populateProfile = (data: {
    brokerage: Brokerage;
    invoices?: BrokerageInvoice[];
    pendingOrders?: BrokerageOrder[];
    mappedOrders?: BrokerageOrder[];
    stats?: BrokerageStats;
  }) => {
    setBrokerage(data.brokerage);
    setInvoices(data.invoices || []);
    setPendingOrders(data.pendingOrders || []);
    setMappedOrders(data.mappedOrders || []);
    setStats(data.stats || emptyStats);
    setScheduleInterval(data.brokerage.autoInvoiceInterval || "MONTHLY");
    setEditForm({
      name: data.brokerage.name || "",
      address: data.brokerage.address || "",
      email: data.brokerage.email || "",
      phone: data.brokerage.phone || "",
      billingType: data.brokerage.billingType || "AGENT",
      basePrice: data.brokerage.basePriceCents == null
        ? ""
        : (data.brokerage.basePriceCents / 100).toFixed(2),
      isActive: data.brokerage.isActive,
    });
  };

  const fetchBrokerage = async () => {
      try {
        setPageError("");
        const res = await fetch(`/api/admin/brokerages/${brokerageId}`);
        if (!res.ok) throw new Error("Failed to fetch brokerage");
        const data = await res.json();
        populateProfile(data);
      } catch (err) {
        setPageError(err instanceof Error ? err.message : "Failed to fetch brokerage");
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    if (status === "authenticated" && brokerageId) {
      void fetchBrokerage();
    }
  }, [status, brokerageId]);

  const outstandingInvoices = useMemo(
    () => invoices.filter((invoice) => isOutstandingInvoiceStatus(invoice.status)),
    [invoices]
  );
  const selectedOrder = mappedOrders.find((order) => order.id === selectedOrderId) || null;
  const mapCenter = mappedOrders.length
    ? { lat: Number(mappedOrders[0].addressLat), lng: Number(mappedOrders[0].addressLng) }
    : { lat: 47.6062, lng: -122.3321 };
  const mapKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";

  const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const handleSaveBrokerage = async () => {
    const parsedBasePrice = editForm.basePrice.trim() ? Number(editForm.basePrice) : null;
    if (!editForm.name.trim()) {
      setPageError("Brokerage name is required");
      return;
    }
    if (parsedBasePrice !== null && (!Number.isFinite(parsedBasePrice) || parsedBasePrice < 0)) {
      setPageError("Base price must be a valid nonnegative amount");
      return;
    }

    try {
      setEditSubmitting(true);
      setPageError("");
      const response = await fetch(`/api/admin/brokerages/${brokerageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          address: editForm.address.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim(),
          billingType: editForm.billingType,
          basePriceDollars: parsedBasePrice,
          isActive: editForm.isActive,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update brokerage");
      await fetchBrokerage();
      setIsEditing(false);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to update brokerage");
    } finally {
      setEditSubmitting(false);
    }
  };

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
      await fetchBrokerage();

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

  const handleSendPasswordReset = async (email?: string) => {
    if (!email) return;
    if (!confirm(`Send a password reset email to ${email}?`)) return;

    try {
      await sendAdminPasswordReset(email);
      alert(`Password reset email sent to ${email}`);
    } catch (err: any) {
      alert(err.message || "Failed to send password reset email");
    }
  };

  const handleInvoiceSchedule = async (action: "APPROVE" | "DENY" | "DISABLE") => {
    try {
      setScheduleSubmitting(true);
      setPageError("");
      const response = await fetch(`/api/admin/brokerages/${brokerageId}/invoice-schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, interval: scheduleInterval }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update automatic invoicing");
      await fetchBrokerage();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to update automatic invoicing");
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const handleCsvImport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!csvFile) {
      setCsvError("Select a CSV file");
      return;
    }

    try {
      setCsvImporting(true);
      setCsvError("");
      setCsvResult(null);
      const upload = new FormData();
      upload.append("file", csvFile);
      const response = await fetch(`/api/admin/brokerages/${brokerageId}/agents/import`, {
        method: "POST",
        body: upload,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to import realtors");
      setCsvResult(data);
      setCsvFile(null);
      await fetchBrokerage();
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : "Failed to import realtors");
    } finally {
      setCsvImporting(false);
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
          <Link href="/admin/brokerages?tab=brokerages" className="text-primary hover:underline">
            Back to Brokerages
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <Link href="/admin/brokerages?tab=brokerages" className="text-primary hover:underline mb-6 inline-block">
          ← Back to Brokerages
        </Link>

        {pageError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {pageError}
          </div>
        )}

        <section className="mb-6 border-y border-gray-200 bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">{brokerage.name}</h1>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${brokerage.isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                  {brokerage.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                {brokerage.address || "No address"} · {brokerage.phone || "No phone"} · {brokerage.email || "No billing email"}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsEditing((current) => !current)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {isEditing ? "Cancel" : "Edit Brokerage"}
              </button>
              <button
                type="button"
                onClick={() => handleSendPasswordReset(brokerage.admin.email)}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Reset Admin Password
              </button>
            </div>
          </div>

          {isEditing ? (
            <div className="mt-6 grid gap-4 border-t border-gray-200 pt-5 md:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-medium text-gray-700">
                Brokerage Name
                <input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900" />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Address
                <input value={editForm.address} onChange={(event) => setEditForm({ ...editForm, address: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900" />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Billing Email
                <input type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900" />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Phone
                <input value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900" />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Billing Type
                <select value={editForm.billingType} onChange={(event) => setEditForm({ ...editForm, billingType: event.target.value as "AGENT" | "BROKERAGE" })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900">
                  <option value="AGENT">Agents pay</option>
                  <option value="BROKERAGE">Brokerage pays</option>
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">
                Base Price ($)
                <input type="number" min="0" step="0.01" value={editForm.basePrice} onChange={(event) => setEditForm({ ...editForm, basePrice: event.target.value })} placeholder="Standard pricing" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900" />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={editForm.isActive} onChange={(event) => setEditForm({ ...editForm, isActive: event.target.checked })} />
                Active brokerage
              </label>
              <div className="md:col-span-2 lg:col-span-3">
                <button type="button" onClick={() => void handleSaveBrokerage()} disabled={editSubmitting} className="rounded-md bg-green-700 px-5 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50">
                  {editSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 border-t border-gray-200 pt-5 sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-xs uppercase text-gray-500">Account Admin</p><p className="mt-1 font-medium text-gray-900">{brokerage.admin.firstName} {brokerage.admin.lastName}</p><p className="text-sm text-gray-600">{brokerage.admin.email}</p></div>
              <div><p className="text-xs uppercase text-gray-500">Billing Type</p><p className="mt-1 font-medium text-gray-900">{brokerage.billingType === "BROKERAGE" ? "Brokerage pays" : "Agents pay"}</p></div>
              <div><p className="text-xs uppercase text-gray-500">Base Price</p><p className="mt-1 font-medium text-gray-900">{brokerage.basePriceCents == null ? "Standard pricing" : formatMoney(brokerage.basePriceCents)}</p></div>
              <div><p className="text-xs uppercase text-gray-500">Agents</p><p className="mt-1 font-medium text-gray-900">{brokerage.agents.length}</p></div>
            </div>
          )}
        </section>

        <section className="mb-6 border-y border-gray-200 bg-white p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900">Automatic Invoicing Permission</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  brokerage.autoInvoiceStatus === "APPROVED"
                    ? "bg-green-100 text-green-800"
                    : brokerage.autoInvoiceStatus === "PENDING"
                      ? "bg-amber-100 text-amber-800"
                      : brokerage.autoInvoiceStatus === "DENIED"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-700"
                }`}>
                  {brokerage.autoInvoiceStatus}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                {brokerage.autoInvoiceStatus === "PENDING"
                  ? `Requested ${brokerage.autoInvoiceInterval === "BIWEEKLY" ? "every two weeks" : "monthly"}${brokerage.autoInvoiceRequestedAt ? ` on ${new Date(brokerage.autoInvoiceRequestedAt).toLocaleDateString()}` : ""}.`
                  : brokerage.autoInvoiceStatus === "APPROVED" && brokerage.autoInvoiceNextRunAt
                    ? `Next statement runs ${new Date(brokerage.autoInvoiceNextRunAt).toLocaleDateString()}.`
                    : "No approved automatic statement schedule."}
              </p>
              {brokerage.billingType !== "BROKERAGE" && (
                <p className="mt-2 text-sm font-medium text-orange-700">Set Billing Type to Brokerage pays before approval.</p>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm font-medium text-gray-700">
                Interval
                <select
                  value={scheduleInterval}
                  onChange={(event) => setScheduleInterval(event.target.value as "MONTHLY" | "BIWEEKLY")}
                  className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-gray-900"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="BIWEEKLY">Every two weeks</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => void handleInvoiceSchedule("APPROVE")}
                disabled={scheduleSubmitting || brokerage.billingType !== "BROKERAGE"}
                className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
              >
                {brokerage.autoInvoiceStatus === "APPROVED" ? "Update Approval" : "Approve"}
              </button>
              {brokerage.autoInvoiceStatus === "PENDING" && (
                <button
                  type="button"
                  onClick={() => void handleInvoiceSchedule("DENY")}
                  disabled={scheduleSubmitting}
                  className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Deny
                </button>
              )}
              {brokerage.autoInvoiceStatus === "APPROVED" && (
                <button
                  type="button"
                  onClick={() => void handleInvoiceSchedule("DISABLE")}
                  disabled={scheduleSubmitting}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Disable
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="border-y border-gray-200 bg-white p-5"><p className="text-sm text-gray-600">Outstanding</p><p className="mt-1 text-2xl font-bold text-orange-700">{formatMoney(stats.outstandingBalance)}</p><p className="text-xs text-gray-500">{stats.outstandingInvoiceCount} invoices</p></div>
          <div className="border-y border-gray-200 bg-white p-5"><p className="text-sm text-gray-600">Lifetime Invoiced</p><p className="mt-1 text-2xl font-bold text-gray-900">{formatMoney(stats.lifetimeInvoiceTotal)}</p><p className="text-xs text-gray-500">{stats.lifetimeInvoiceCount} invoices</p></div>
          <div className="border-y border-gray-200 bg-white p-5"><p className="text-sm text-gray-600">Lifetime Paid</p><p className="mt-1 text-2xl font-bold text-green-700">{formatMoney(stats.lifetimePaidTotal)}</p></div>
          <div className="border-y border-gray-200 bg-white p-5"><p className="text-sm text-gray-600">Pending Orders</p><p className="mt-1 text-2xl font-bold text-amber-700">{stats.pendingOrderCount}</p><p className="text-xs text-gray-500">{stats.totalOrders} lifetime orders</p></div>
          <div className="border-y border-gray-200 bg-white p-5"><p className="text-sm text-gray-600">Mapped Posts</p><p className="mt-1 text-2xl font-bold text-blue-700">{stats.mappedPostCount}</p></div>
        </section>

        <section className="mb-6 border-y border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Outstanding Invoices</h2>
          {outstandingInvoices.length === 0 ? <p className="text-sm text-gray-600">No outstanding invoices.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-gray-600"><th className="py-3 pr-4">Invoice</th><th className="py-3 pr-4">Agent</th><th className="py-3 pr-4">Status</th><th className="py-3 pr-4">Due</th><th className="py-3 text-right">Balance</th></tr></thead><tbody>
              {outstandingInvoices.map((invoice) => {
                const total = (invoice.amount || 0) - (invoice.discountAmount || 0) + invoice.taxAmount;
                const balance = Math.max(0, total - (invoice.paidAmount || 0));
                return <tr key={invoice.id} className="border-b border-gray-100"><td className="py-3 pr-4"><Link href={`/admin/invoices/${invoice.id}`} className="font-medium text-blue-700 hover:text-blue-900">{invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8).toUpperCase()}`}</Link></td><td className="py-3 pr-4 text-gray-700">{invoice.user.firstName} {invoice.user.lastName}</td><td className="py-3 pr-4"><span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800">{invoice.status}</span></td><td className="py-3 pr-4 text-gray-600">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "—"}</td><td className="py-3 text-right font-semibold text-gray-900">{formatMoney(balance)}</td></tr>;
              })}
            </tbody></table></div>
          )}
          <h2 className="mb-4 mt-8 border-t border-gray-200 pt-6 text-xl font-semibold text-gray-900">Lifetime Invoice History</h2>
          {invoices.length === 0 ? <p className="text-sm text-gray-600">No invoices have been created for this brokerage.</p> : (
            <div className="max-h-[420px] overflow-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-white"><tr className="border-b text-left text-gray-600"><th className="py-3 pr-4">Invoice</th><th className="py-3 pr-4">Agent</th><th className="py-3 pr-4">Created</th><th className="py-3 pr-4">Status</th><th className="py-3 text-right">Total</th></tr></thead><tbody>
              {invoices.map((invoice) => <tr key={invoice.id} className="border-b border-gray-100"><td className="py-3 pr-4"><Link href={`/admin/invoices/${invoice.id}`} className="font-medium text-blue-700 hover:text-blue-900">{invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8).toUpperCase()}`}</Link></td><td className="py-3 pr-4 text-gray-700">{invoice.user.firstName} {invoice.user.lastName}</td><td className="py-3 pr-4 text-gray-600">{new Date(invoice.createdAt).toLocaleDateString()}</td><td className="py-3 pr-4"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{invoice.status}</span></td><td className="py-3 text-right font-semibold text-gray-900">{formatMoney(Math.max(0, (invoice.amount || 0) - (invoice.discountAmount || 0) + invoice.taxAmount))}</td></tr>)}
            </tbody></table></div>
          )}
        </section>

        <section className="mb-6 grid gap-6 xl:grid-cols-5">
          <div className="border-y border-gray-200 bg-white p-6 xl:col-span-2">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Pending Orders</h2>
            {pendingOrders.length === 0 ? <p className="text-sm text-gray-600">No pending orders.</p> : <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
              {pendingOrders.map((order) => <Link key={order.id} href={`/admin/orders/${order.id}`} className="block rounded-md border border-gray-200 p-3 hover:bg-gray-50"><div className="flex items-center justify-between gap-3"><p className="font-medium text-gray-900">{order.orderNumber}</p><span className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(order.status)}`}>{order.status.replace(/_/g, " ")}</span></div><p className="mt-1 text-sm text-gray-600">{order.address}</p><p className="mt-1 text-xs text-gray-500">{order.realtor.firstName} {order.realtor.lastName} · {new Date(order.createdAt).toLocaleDateString()}</p></Link>)}
            </div>}
          </div>
          <div className="border-y border-gray-200 bg-white p-4 xl:col-span-3">
            <div className="mb-3 flex items-center justify-between px-2"><h2 className="text-xl font-semibold text-gray-900">Brokerage Posts Map</h2><span className="text-sm text-gray-600">{mappedOrders.length} mapped</span></div>
            {!mapKey ? <div className="flex h-[520px] items-center justify-center border border-red-200 bg-red-50 p-4 text-sm text-red-800">Google Maps is not configured.</div> : (
              <div className="relative h-[520px] overflow-hidden border border-gray-200"><GoogleMapReact bootstrapURLKeys={{ key: mapKey, libraries: ["places"] }} defaultCenter={mapCenter} defaultZoom={mappedOrders.length === 0 ? 13 : 9} yesIWantToUseGoogleMapApiInternals onGoogleApiLoaded={({ map, maps }) => { if (mappedOrders.length === 0) { if (!brokerage.address) { setOfficeLocationStatus("not-found"); return; } setOfficeLocationStatus("loading"); const showOfficeLocation = (location: any) => { map.setCenter(location); map.setZoom(13); setOfficeLocationStatus("found"); }; const findOfficeWithPlaces = () => { if (!maps.places) { setOfficeLocationStatus("not-found"); return; } const places = new maps.places.PlacesService(map); places.findPlaceFromQuery({ query: brokerage.address, fields: ["geometry"] }, (placesResults: any[], placesStatus: string) => { const location = placesResults?.[0]?.geometry?.location; if (placesStatus === maps.places.PlacesServiceStatus.OK && location) { showOfficeLocation(location); } else { setOfficeLocationStatus("not-found"); } }); }; const geocoder = new maps.Geocoder(); geocoder.geocode({ address: brokerage.address, componentRestrictions: { country: "US" } }, (results: any[], geocodeStatus: string) => { const location = results?.[0]?.geometry?.location; if (geocodeStatus === "OK" && location) { showOfficeLocation(location); } else { findOfficeWithPlaces(); } }); return; } if (mappedOrders.length === 1) { map.setCenter(mapCenter); map.setZoom(13); return; } const bounds = new maps.LatLngBounds(); mappedOrders.forEach((order) => bounds.extend({ lat: Number(order.addressLat), lng: Number(order.addressLng) })); map.fitBounds(bounds, 48); }}>{mappedOrders.map((order) => <OrderMarker key={order.id} lat={Number(order.addressLat)} lng={Number(order.addressLng)} order={order} selected={selectedOrderId === order.id} onClick={() => setSelectedOrderId(order.id)} />)}</GoogleMapReact>
                {mappedOrders.length === 0 && <div className="pointer-events-none absolute left-4 top-4 border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow">{officeLocationStatus === "loading" ? "Finding office location..." : officeLocationStatus === "found" ? "No mapped posts. Showing office location." : brokerage.address ? "Office location could not be found." : "No mapped posts or office address."}</div>}
                {selectedOrder && <div className="absolute bottom-4 left-4 w-80 max-w-[calc(100%-2rem)] border border-gray-200 bg-white p-4 shadow-lg"><p className="font-semibold text-gray-900">{selectedOrder.orderNumber}</p><p className="mt-1 text-sm text-gray-600">{selectedOrder.address}</p><p className="mt-1 text-xs text-gray-500">{selectedOrder.realtor.firstName} {selectedOrder.realtor.lastName}</p><Link href={`/admin/orders/${selectedOrder.id}`} className="mt-3 inline-block text-sm font-medium text-blue-700 hover:text-blue-900">View Order Details</Link></div>}
              </div>
            )}
          </div>
        </section>

        <div className="bg-white border-y border-gray-200 p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Agents ({brokerage.agents.length})</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCsvImport((current) => !current);
                  setShowAddAgent(false);
                }}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {showCsvImport ? "Cancel Import" : "Import CSV"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddAgent((current) => !current);
                  setShowCsvImport(false);
                }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
              >
                {showAddAgent ? "Cancel" : "Add Agent"}
              </button>
            </div>
          </div>

          {showCsvImport && (
            <form onSubmit={handleCsvImport} className="mb-6 border-y border-gray-200 bg-gray-50 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <label htmlFor="realtor-csv" className="block text-sm font-medium text-gray-700">
                    Realtor CSV
                  </label>
                  <input
                    id="realtor-csv"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => {
                      setCsvFile(event.target.files?.[0] || null);
                      setCsvError("");
                      setCsvResult(null);
                    }}
                    className="mt-1 block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-gray-200 file:px-4 file:py-2 file:font-medium file:text-gray-800 hover:file:bg-gray-300"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="data:text/csv;charset=utf-8,name%2Cemail%2Cphone%0AJane%20Realtor%2Cjane%40example.com%2C555-0100"
                    download="realtor-import-template.csv"
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Download Template
                  </a>
                  <button
                    type="submit"
                    disabled={!csvFile || csvImporting}
                    className="rounded-md bg-green-700 px-5 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {csvImporting ? "Importing..." : "Import Realtors"}
                  </button>
                </div>
              </div>
              {csvError && <p className="mt-4 text-sm font-medium text-red-700">{csvError}</p>}
              {csvResult && (
                <div className="mt-4 border-t border-gray-200 pt-4 text-sm">
                  <p className="font-medium text-gray-900">
                    {csvResult.created} created · {csvResult.emailsSent} welcome emails sent · {csvResult.failed} issues
                  </p>
                  {csvResult.results.length > 0 && (
                    <ul className="mt-2 max-h-40 overflow-y-auto text-red-700">
                      {csvResult.results.map((result, index) => (
                        <li key={`${result.rowNumber}-${index}`}>Row {result.rowNumber}: {result.error}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </form>
          )}

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
                        <button
                          onClick={() => handleSendPasswordReset(agent.email)}
                          className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                        >
                          Reset Password
                        </button>
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
