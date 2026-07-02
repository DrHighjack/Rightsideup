"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { sendAdminPasswordReset } from "@/lib/admin-password-reset";

interface ActivityLogEntry {
  id: string;
  action: string;
  entityType: string;
  description: string;
  createdAt: string;
}

interface Order {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  address: string;
  createdAt: string;
  scheduledDate?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  total: number;
  paid: number;
  status: string;
  createdAt: string;
}

interface RealtorDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  paymentMethod: string;
  brokerageName?: string;
  tags: string[];
  adminNotes?: string;
  freeInstallGivenBy?: string;
  freeInstallDate?: string;
  createdAt: string;
}

interface RealtorStats {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
}

interface AdminNote {
  text: string;
  createdAt: string;
  adminId: string;
}

interface Closer {
  id: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "SALESMEN";
}

export default function RealtorDetailPage() {
  const { status, data: sessionData } = useSession();
  const router = useRouter();
  const params = useParams();
  const realtorId = params.id as string;

  const [realtor, setRealtor] = useState<RealtorDetail | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [stats, setStats] = useState<RealtorStats>({
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "completed" | "cancelled">("all");
  const [activeTab, setActiveTab] = useState<"orders" | "financial" | "activity" | "notes">("orders");
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<RealtorDetail | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Tags state
  const [newTag, setNewTag] = useState("");
  
  // Notes state
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [addingNote, setAddingNote] = useState(false);
  
  // Free install state
  const [allocatingFreeInstall, setAllocatingFreeInstall] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditCode, setCreditCode] = useState("");
  const [creditExpirationDate, setCreditExpirationDate] = useState("");
  const [sendingCredit, setSendingCredit] = useState(false);
  const [closers, setClosers] = useState<Closer[]>([]);
  const [updatingActivation, setUpdatingActivation] = useState(false);
  const [generatingLoginLink, setGeneratingLoginLink] = useState(false);
  const [clientLoginLink, setClientLoginLink] = useState("");
  const [pendingActivationState, setPendingActivationState] = useState<boolean | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch realtor details
        const userRes = await fetch(`/api/admin/users/${realtorId}`);
        if (!userRes.ok) throw new Error("Failed to fetch realtor");
        const userData = await userRes.json();
        setRealtor(userData.user);
        setEditData(userData.user);

        const closersRes = await fetch("/api/admin/users?role=ADMIN,SALESMEN&limit=200");
        if (closersRes.ok) {
          const closersData = await closersRes.json();
          setClosers(closersData.users || []);
        }

        // Parse admin notes
        if (userData.user.adminNotes) {
          try {
            const parsedNotes = JSON.parse(userData.user.adminNotes);
            setNotes(Array.isArray(parsedNotes) ? parsedNotes : []);
          } catch {
            setNotes([]);
          }
        }

        // Fetch realtor's orders
        const ordersRes = await fetch(`/api/admin/users/${realtorId}/orders`);
        if (!ordersRes.ok) throw new Error("Failed to fetch orders");
        const ordersData = await ordersRes.json();
        setOrders(ordersData.orders || []);

        // Fetch realtor's invoices
        const invoicesRes = await fetch(`/api/admin/invoices?realtorId=${realtorId}`);
        if (invoicesRes.ok) {
          const invoicesData = await invoicesRes.json();
          setInvoices(invoicesData.invoices || []);
        }

        // Fetch activity logs for this user's records
        const activityRes = await fetch(`/api/admin/activity?userId=${realtorId}&limit=100`);
        if (activityRes.ok) {
          const activityData = await activityRes.json();
          setActivityLogs(activityData.logs || []);
        }

        // Calculate stats
        const allOrders = ordersData.orders || [];
        setStats({
          totalOrders: allOrders.length,
          activeOrders: allOrders.filter((o: Order) => ["PENDING", "SCHEDULED", "IN_PROGRESS"].includes(o.status)).length,
          completedOrders: allOrders.filter((o: Order) => ["IN_GROUND", "COMPLETED"].includes(o.status)).length,
          cancelledOrders: allOrders.filter((o: Order) => o.status === "CANCELLED").length,
        });
      } catch (err) {
        setError("Failed to load realtor details");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (status === "authenticated" && realtorId) {
      fetchData();
    }
  }, [status, realtorId]);

  const handleSave = async () => {
    if (!editData) return;
    
    try {
      setIsSaving(true);
      setError("");

      const response = await fetch(`/api/admin/users/${realtorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editData.firstName,
          lastName: editData.lastName,
          email: editData.email,
          phone: editData.phone,
          paymentMethod: editData.paymentMethod,
          brokerageName: editData.brokerageName,
          closedByUserId: editData.freeInstallGivenBy || null,
          tags: editData.tags,
          adminNotes: JSON.stringify(notes),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }

      const data = await response.json();
      setRealtor(data.user);
      setIsEditing(false);
    } catch (err) {
      setError((err as Error).message || "Failed to save changes");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && editData) {
      const updatedTags = [...editData.tags, newTag.trim()];
      setEditData({ ...editData, tags: updatedTags });
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (editData) {
      const updatedTags = editData.tags.filter(t => t !== tagToRemove);
      setEditData({ ...editData, tags: updatedTags });
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !editData) return;

    try {
      setAddingNote(true);
      const newNote: AdminNote = {
        text: noteText.trim(),
        createdAt: new Date().toISOString(),
        adminId: (sessionData?.user as any)?.id || "unknown",
      };

      const updatedNotes = [...notes, newNote];
      setNotes(updatedNotes);

      // Save to database
      const response = await fetch(`/api/admin/users/${realtorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editData.firstName,
          lastName: editData.lastName,
          email: editData.email,
          phone: editData.phone,
          brokerageName: editData.brokerageName,
          tags: editData.tags,
          adminNotes: JSON.stringify(updatedNotes),
        }),
      });

      if (response.ok) {
        setNoteText("");
      }
    } catch (err) {
      console.error("Failed to add note:", err);
    } finally {
      setAddingNote(false);
    }
  };

  const handleFreeInstallToggle = async () => {
    if (!realtor) return;

    try {
      setAllocatingFreeInstall(true);
      const response = await fetch(
        `/api/salesmen/clients/${realtorId}/free-install`,
        { method: "POST" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update free install");
      }

      const data = await response.json();
      setRealtor({
        ...realtor,
        freeInstallGivenBy: data.client.freeInstallGivenBy,
        freeInstallDate: data.client.freeInstallDate,
      });
    } catch (err) {
      console.error("Failed to update free install:", err);
      setError((err as Error).message || "Failed to update free install");
    } finally {
      setAllocatingFreeInstall(false);
    }
  };

  const handleSendCredit = async () => {
    if (!creditAmount.trim() || !creditCode.trim() || !creditExpirationDate.trim()) {
      setError("Credit amount, code, and expiration date are required");
      return;
    }

    const parsedAmount = Number(creditAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Credit amount must be a positive number");
      return;
    }

    try {
      setSendingCredit(true);
      setError("");

      const response = await fetch(`/api/admin/users/${realtorId}/send-credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditAmount: parsedAmount,
          creditCode: creditCode.trim(),
          expirationDate: creditExpirationDate,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to send credit");
      }

      alert(`Credit code ${data.credit?.code || creditCode.trim()} sent to ${realtor?.firstName || "realtor"}`);
      setCreditAmount("");
      setCreditCode("");
      setCreditExpirationDate("");
    } catch (err) {
      setError((err as Error).message || "Failed to send credit");
    } finally {
      setSendingCredit(false);
    }
  };

  const handleSendPasswordReset = async (email: string) => {
    if (!confirm(`Send a password reset email to ${email}?`)) return;

    try {
      await sendAdminPasswordReset(email);
      alert(`Password reset email sent to ${email}`);
    } catch (err) {
      setError((err as Error).message || "Failed to send password reset email");
      console.error(err);
    }
  };

  const handleSetAccountActive = async (isActive: boolean) => {
    if (!realtor || !editData) return;

    try {
      setUpdatingActivation(true);
      setError("");

      const response = await fetch(`/api/admin/users/${realtorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update account status");
      }

      const data = await response.json();
      setRealtor(data.user);
      setEditData(data.user);
      if (!isActive) {
        setClientLoginLink("");
      }
    } catch (err) {
      setError((err as Error).message || "Failed to update account status");
    } finally {
      setUpdatingActivation(false);
    }
  };

  const requestActivationChange = (isActive: boolean) => {
    setPendingActivationState(isActive);
  };

  const closeActivationModal = () => {
    setPendingActivationState(null);
  };

  const confirmActivationChange = async () => {
    if (pendingActivationState === null) return;
    const targetState = pendingActivationState;
    setPendingActivationState(null);
    await handleSetAccountActive(targetState);
  };

  const handleGenerateClientLoginLink = async () => {
    try {
      setGeneratingLoginLink(true);
      setError("");

      const response = await fetch(`/api/admin/users/${realtorId}/impersonate`, {
        method: "POST",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate login link");
      }

      setClientLoginLink(data.loginUrl);

      try {
        await navigator.clipboard.writeText(data.loginUrl);
      } catch {
        // Keep the link visible even if clipboard write fails.
      }
    } catch (err) {
      setError((err as Error).message || "Failed to generate login link");
    } finally {
      setGeneratingLoginLink(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!realtor || deletingAccount) return;

    const confirmation = prompt(
      `Type DELETE to permanently remove ${realtor.email}. This cannot be undone.`
    );
    if (confirmation !== "DELETE") {
      return;
    }

    try {
      setDeletingAccount(true);
      setError("");

      const response = await fetch(`/api/admin/users/${realtorId}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to permanently delete account");
      }

      alert("Account permanently deleted");
      router.push("/admin/clients");
      router.refresh();
    } catch (err) {
      setError((err as Error).message || "Failed to permanently delete account");
    } finally {
      setDeletingAccount(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "SCHEDULED":
        return "bg-blue-100 text-blue-800";
      case "IN_PROGRESS":
        return "bg-purple-100 text-purple-800";
      case "IN_GROUND":
        return "bg-cyan-100 text-cyan-800";
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const selectedCloser = closers.find((c) => c.id === realtor?.freeInstallGivenBy);
  const isAdmin = (sessionData?.user as any)?.role === "ADMIN";
  const isInactive = realtor?.tags.includes("INACTIVE") ?? false;

  const filteredOrders = orders.filter((order) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "active") return ["PENDING", "SCHEDULED", "IN_PROGRESS"].includes(order.status);
    if (filterStatus === "completed") return ["IN_GROUND", "COMPLETED"].includes(order.status);
    if (filterStatus === "cancelled") return order.status === "CANCELLED";
    return true;
  });

  // Financial calculations
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.paid, 0);
  const outstandingBalance = totalInvoiced - totalPaid;
  const avgOrderValue = orders.length > 0 ? totalInvoiced / orders.length : 0;

  if (status === "loading" || loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!realtor || !editData) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <Link href="/admin/clients" className="text-green-600 hover:text-green-700 mb-4 inline-block">
            ← Back to Clients
          </Link>
          <div className="bg-red-50 p-4 rounded-lg text-red-800">Realtor not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/admin/clients" className="text-green-600 hover:text-green-700 mb-4 inline-block">
            ← Back to Clients
          </Link>
          <div className="bg-white rounded-lg shadow p-6">
            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            {/* Profile Section */}
            <div className="flex justify-between items-start mb-6">
              <div>
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={editData.firstName}
                        onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                        placeholder="First Name"
                        className="border border-gray-300 rounded px-3 py-2"
                      />
                      <input
                        type="text"
                        value={editData.lastName}
                        onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                        placeholder="Last Name"
                        className="border border-gray-300 rounded px-3 py-2"
                      />
                    </div>
                    <input
                      type="email"
                      value={editData.email}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      placeholder="Email"
                      className="w-full border border-gray-300 rounded px-3 py-2"
                    />
                  </div>
                ) : (
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                      {realtor.firstName} {realtor.lastName}
                    </h1>
                    <div className="flex items-center gap-2">
                      <p className="text-gray-600">{realtor.email}</p>
                      {isInactive && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditData(realtor);
                      }}
                      className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      Edit
                    </button>
                      <button
                        onClick={() => handleSendPasswordReset(realtor.email)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                      >
                        Reset Password
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => requestActivationChange(isInactive)}
                          disabled={updatingActivation}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                            isInactive
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "bg-red-600 text-white hover:bg-red-700"
                          }`}
                        >
                          {updatingActivation
                            ? "Updating..."
                            : isInactive
                              ? "Re-enable Account"
                              : "Deactivate Account"}
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={handleGenerateClientLoginLink}
                          disabled={generatingLoginLink || isInactive}
                          className="bg-amber-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                        >
                          {generatingLoginLink ? "Generating..." : "Generate Login Link"}
                        </button>
                      )}
                    {isAdmin && isInactive && (
                      <button
                        onClick={handlePermanentDelete}
                        disabled={deletingAccount}
                        className="bg-red-700 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-800 disabled:opacity-50 transition-colors"
                      >
                        {deletingAccount ? "Deleting..." : "Delete Permanently"}
                      </button>
                    )}
                    <Link
                      href={`/admin/orders/new?realtorId=${realtorId}`}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                    >
                      Book Order
                    </Link>
                  </>
                )}
              </div>
            </div>

            {clientLoginLink && isAdmin && (
              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="mb-2 text-sm font-medium text-amber-900">
                  Admin login-as-client link (expires in 10 minutes)
                </p>
                <a
                  href={clientLoginLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm text-amber-800 underline"
                >
                  {clientLoginLink}
                </a>
              </div>
            )}

            {pendingActivationState !== null && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">Are you sure?</h3>
                  <p className="mb-6 text-sm text-gray-700">
                    {pendingActivationState
                      ? `Re-enable account for ${realtor.email}?`
                      : `Deactivate account for ${realtor.email}? They will no longer be able to sign in.`}
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={closeActivationModal}
                      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void confirmActivationChange()}
                      className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                        pendingActivationState
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      {pendingActivationState ? "Re-enable" : "Deactivate"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Editable Fields */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-gray-600 text-sm">Phone</p>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editData.phone || ""}
                    onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                ) : (
                  <p className="text-gray-900 font-medium">{realtor.phone || "—"}</p>
                )}
              </div>
              <div>
                <p className="text-gray-600 text-sm">Payment Method</p>
                {isEditing ? (
                  <select
                    value={editData.paymentMethod || "OFFICE"}
                    onChange={(e) => setEditData({ ...editData, paymentMethod: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="OFFICE">Office Pays</option>
                    <option value="SELF">Agent Pays</option>
                  </select>
                ) : (
                  <p className="text-gray-900 font-medium">
                    {realtor.paymentMethod === "OFFICE" ? "Office Pays" : "Agent Pays"}
                  </p>
                )}
              </div>
              <div>
                <p className="text-gray-600 text-sm">Closed By</p>
                {isEditing ? (
                  <select
                    value={editData.freeInstallGivenBy || ""}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        freeInstallGivenBy: e.target.value || undefined,
                      })
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="">Not Assigned</option>
                    {closers.map((closer) => (
                      <option key={closer.id} value={closer.id}>
                        {closer.firstName} {closer.lastName} ({closer.role})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-gray-900 font-medium">
                    {selectedCloser
                      ? `${selectedCloser.firstName} ${selectedCloser.lastName} (${selectedCloser.role})`
                      : "—"}
                  </p>
                )}
              </div>
              <div>
                <p className="text-gray-600 text-sm">Brokerage</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.brokerageName || ""}
                    onChange={(e) => setEditData({ ...editData, brokerageName: e.target.value })}
                    placeholder="Brokerage Name"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                ) : (
                  <p className="text-gray-900 font-medium">{realtor.brokerageName || "—"}</p>
                )}
              </div>
              <div>
                <p className="text-gray-600 text-sm">Member Since</p>
                <p className="text-gray-900 font-medium">{formatDate(realtor.createdAt)}</p>
              </div>
            </div>

            {/* Tags Section */}
            <div className="border-t pt-4">
              <p className="text-gray-600 text-sm font-medium mb-2">Tags</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {editData.tags.map((tag) => (
                  <div key={tag} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                    {tag}
                    {isEditing && (
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-blue-600 hover:text-blue-800 font-bold"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {isEditing && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleAddTag()}
                    placeholder="Add a tag..."
                    className="border border-gray-300 rounded px-3 py-2 flex-1"
                  />
                  <button
                    onClick={handleAddTag}
                    className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Credit Section */}
            <div className="border-t pt-4">
              <p className="text-gray-600 text-sm font-medium mb-2">Credit</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="Credit amount"
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="text"
                  value={creditCode}
                  onChange={(e) => setCreditCode(e.target.value)}
                  placeholder="Credit code"
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="date"
                  value={creditExpirationDate}
                  onChange={(e) => setCreditExpirationDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500">Creates a reusable credit code that can be applied across orders until the balance is gone.</p>
                <button
                  onClick={handleSendCredit}
                  disabled={sendingCredit}
                  className="px-4 py-2 rounded font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                >
                  {sendingCredit ? "Sending..." : "Send Credit"}
                </button>
              </div>
            </div>

            {/* Free Install Section */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-2">Free Install</p>
                  {realtor.freeInstallGivenBy ? (
                    <div className="bg-green-50 p-3 rounded border border-green-200">
                      <p className="text-sm text-green-800 font-medium">✓ Allocated</p>
                      <p className="text-xs text-green-700 mt-1">
                        {formatDate(realtor.freeInstallDate!)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">Not allocated</p>
                  )}
                </div>
                <button
                  onClick={handleFreeInstallToggle}
                  disabled={allocatingFreeInstall}
                  className={`px-4 py-2 rounded font-medium transition-colors ${
                    realtor.freeInstallGivenBy
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  } disabled:opacity-50`}
                >
                  {allocatingFreeInstall ? "..." : realtor.freeInstallGivenBy ? "Revoke" : "Give"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm font-medium">Total Orders</p>
            <p className="text-3xl font-bold text-gray-900">{stats.totalOrders}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-400">
            <p className="text-gray-600 text-sm font-medium">Active Orders</p>
            <p className="text-3xl font-bold text-yellow-600">{stats.activeOrders}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-400">
            <p className="text-gray-600 text-sm font-medium">Completed</p>
            <p className="text-3xl font-bold text-green-600">{stats.completedOrders}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-400">
            <p className="text-gray-600 text-sm font-medium">Cancelled</p>
            <p className="text-3xl font-bold text-red-600">{stats.cancelledOrders}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 px-6">
            <div className="flex gap-8">
              {(["orders", "financial", "notes", "activity"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-4 font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? "border-green-600 text-green-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {tab === "orders" && "Orders"}
                  {tab === "financial" && "Financial"}
                  {tab === "notes" && "Notes"}
                  {tab === "activity" && "Activity"}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Tab */}
          {activeTab === "orders" && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Order History</h2>
              
              {/* Filter Tabs */}
              <div className="flex gap-2 mb-4">
                {(["all", "active", "completed", "cancelled"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      filterStatus === s
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {s === "all"
                      ? "All Orders"
                      : s === "active"
                      ? "Active"
                      : s === "completed"
                      ? "Completed"
                      : "Cancelled"}
                    {s !== "all" && (
                      <span className="ml-2 text-sm">
                        ({stats[`${s}Orders` as keyof RealtorStats]})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Orders Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900">Order #</th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900">Type</th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900">Address</th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900">Status</th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900">Date</th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.orderNumber}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{order.type}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{order.address}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatDate(order.createdAt)}</td>
                        <td className="px-6 py-4 text-sm">
                          <Link
                            href={`/admin/orders/${order.orderNumber}`}
                            className="text-green-600 hover:text-green-700 font-medium transition-colors"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredOrders.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-600">
                      {filterStatus === "all" ? "No orders found" : `No ${filterStatus} orders`}
                    </p>
                  </div>
                )}
              </div>

              {/* Results count */}
              <div className="mt-4 text-sm text-gray-600">
                Showing {filteredOrders.length} of {orders.length} orders
              </div>
            </div>
          )}

          {/* Financial Tab */}
          {activeTab === "financial" && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Financial Summary</h2>
              
              {/* Financial Cards */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <p className="text-gray-600 text-sm font-medium mb-1">Total Invoiced</p>
                  <p className="text-3xl font-bold text-blue-600">${totalInvoiced.toFixed(2)}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <p className="text-gray-600 text-sm font-medium mb-1">Total Paid</p>
                  <p className="text-3xl font-bold text-green-600">${totalPaid.toFixed(2)}</p>
                </div>
                <div className={`border rounded-lg p-6 ${outstandingBalance > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                  <p className="text-gray-600 text-sm font-medium mb-1">Outstanding Balance</p>
                  <p className={`text-3xl font-bold ${outstandingBalance > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    ${outstandingBalance.toFixed(2)}
                  </p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <p className="text-gray-600 text-sm font-medium mb-1">Average Order Value</p>
                  <p className="text-3xl font-bold text-purple-600">${avgOrderValue.toFixed(2)}</p>
                </div>
              </div>

              {/* Invoices Table */}
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Invoices</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900">Invoice #</th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900">Total</th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900">Paid</th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900">Balance</th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900">Status</th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-900">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.invoiceNumber}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">${inv.total.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">${inv.paid.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          ${(inv.total - inv.paid).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                            inv.status === "OVERDUE" ? "bg-red-100 text-red-800" :
                            inv.status === "VIEWED" ? "bg-yellow-100 text-yellow-800" :
                            "bg-green-100 text-green-800"
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatDate(inv.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {invoices.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-600">No invoices found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === "notes" && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Admin Notes</h2>
              
              {/* Add Note Form */}
              <div className="mb-6 p-4 border border-gray-300 rounded-lg">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note..."
                  rows={3}
                  className="w-full border border-gray-300 rounded px-3 py-2 mb-3"
                />
                <button
                  onClick={handleAddNote}
                  disabled={addingNote || !noteText.trim()}
                  className="bg-green-600 text-white px-4 py-2 rounded font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {addingNote ? "Adding..." : "Add Note"}
                </button>
              </div>

              {/* Notes List */}
              <div className="space-y-4">
                {notes.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No notes yet</p>
                ) : (
                  notes.map((note, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm text-gray-600 font-medium">
                          {formatDateTime(note.createdAt)}
                        </p>
                        <p className="text-xs text-gray-500">by {note.adminId}</p>
                      </div>
                      <p className="text-gray-900">{note.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === "activity" && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Activity Timeline</h2>
              
              {/* Activity Feed */}
              <div className="space-y-4">
                {activityLogs.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No activity recorded</p>
                ) : (
                  activityLogs.map((log) => (
                    <div key={log.id} className="border-l-4 border-green-500 pl-4 py-2">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-medium text-gray-900">{log.action}</p>
                        <p className="text-sm text-gray-600">{formatDate(log.createdAt)}</p>
                      </div>
                      <p className="text-sm text-gray-600">{log.description}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
