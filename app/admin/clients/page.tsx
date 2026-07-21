"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { sendAdminPasswordReset } from "@/lib/admin-password-reset";

interface RealtorData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  brokerageName?: string;
  phone?: string;
  tags: string[];
  createdAt: string;
  hasOutstandingBalance?: boolean;
  outstandingBalance?: number;
  _count: {
    orders: number;
  };
}

export default function AdminClientsPage() {
  const [realtors, setRealtors] = useState<RealtorData[]>([]);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "has-balance" | "no-balance">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [sendingSMSId, setSendingSMSId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    async function fetchRealtors() {
      try {
        setLoading(true);
        let url = `/api/admin/users?page=${page}&limit=20`;
        if (search) {
          url += `&search=${encodeURIComponent(search)}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        setRealtors(data.users || []);
        setTotalPages(data.pagination?.pages || 1);

        const tags = new Set<string>();
        (data.users || []).forEach((user: RealtorData) => {
          if (Array.isArray(user.tags)) {
            user.tags.forEach((tag) => tags.add(tag));
          }
        });
        setAllTags(Array.from(tags).sort());
      } catch (error) {
        console.error("Failed to fetch realtors:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRealtors();
  }, [page, search]);

  const filteredRealtors = realtors.filter((realtor) => {
    const isInactive = Array.isArray(realtor.tags) && realtor.tags.includes("INACTIVE");

    if (statusFilter === "active" && isInactive) return false;
    if (statusFilter === "inactive" && !isInactive) return false;
    if (selectedTag && (!realtor.tags || !realtor.tags.includes(selectedTag))) return false;
    if (balanceFilter === "has-balance" && !realtor.hasOutstandingBalance) return false;
    if (balanceFilter === "no-balance" && realtor.hasOutstandingBalance) return false;

    return true;
  });

  const handleExportCSV = () => {
    if (filteredRealtors.length === 0) {
      alert("No realtors to export");
      return;
    }

    const headers = ["First Name", "Last Name", "Email", "Brokerage", "Phone", "Orders", "Tags", "Joined"];
    const rows = filteredRealtors.map((realtor) => [
      realtor.firstName,
      realtor.lastName,
      realtor.email,
      realtor.brokerageName || "",
      realtor.phone || "",
      realtor._count.orders,
      (realtor.tags || []).join("; "),
      new Date(realtor.createdAt).toLocaleDateString(),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const str = String(cell);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `realtors_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendSMS = async (realtorId: string) => {
    const message = prompt("Enter SMS message to send:");
    if (!message) return;

    try {
      setSendingSMSId(realtorId);
      const res = await fetch(`/api/admin/users/${realtorId}/send-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (res.ok) {
        alert("SMS sent successfully!");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to send SMS");
      }
    } catch (error) {
      alert("Failed to send SMS");
      console.error(error);
    } finally {
      setSendingSMSId(null);
    }
  };

  const handleSendPasswordReset = async (email: string) => {
    if (!confirm(`Send a password reset email to ${email}?`)) return;

    try {
      await sendAdminPasswordReset(email);
      alert(`Password reset email sent to ${email}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to send password reset email");
      console.error(error);
    }
  };

  const handleToggleActive = async (realtor: RealtorData) => {
    const isInactive = Array.isArray(realtor.tags) && realtor.tags.includes("INACTIVE");
    const nextIsActive = isInactive;
    const actionLabel = nextIsActive ? "reactivate" : "deactivate";

    if (!confirm(`${nextIsActive ? "Reactivate" : "Deactivate"} ${realtor.firstName} ${realtor.lastName}?`)) {
      return;
    }

    try {
      setUpdatingStatusId(realtor.id);

      const res = await fetch(`/api/admin/users/${realtor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextIsActive }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || `Failed to ${actionLabel} account`);
        return;
      }

      setRealtors((prev) =>
        prev.map((existing) =>
          existing.id === realtor.id
            ? {
                ...existing,
                tags: data.user?.tags || existing.tags,
              }
            : existing
        )
      );
    } catch (error) {
      console.error(error);
      alert(`Failed to ${actionLabel} account`);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">Realtor Accounts</h1>
        <p className="mt-1 text-slate-600">Manage realtor accounts and view their order history</p>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div>
          <label htmlFor="search" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Search
          </label>
          <input
            type="text"
            id="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, email, brokerage, or tags..."
            className="h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 placeholder-slate-400 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="status-filter" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Account Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as "all" | "active" | "inactive");
                setPage(1);
              }}
              className="h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
            >
              <option value="all">All Accounts</option>
              <option value="active">!inactive (Active)</option>
              <option value="inactive">inactive</option>
            </select>
          </div>

          <div>
            <label htmlFor="tag-filter" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Filter by Tag
            </label>
            <select
              id="tag-filter"
              value={selectedTag}
              onChange={(e) => {
                setSelectedTag(e.target.value);
                setPage(1);
              }}
              className="h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
            >
              <option value="">All Tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="balance-filter" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Outstanding Balance
            </label>
            <select
              id="balance-filter"
              value={balanceFilter}
              onChange={(e) => {
                setBalanceFilter(e.target.value as "all" | "has-balance" | "no-balance");
                setPage(1);
              }}
              className="h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
            >
              <option value="all">All Clients</option>
              <option value="has-balance">Has Outstanding Balance</option>
              <option value="no-balance">No Outstanding Balance</option>
            </select>
          </div>
        </div>

        <div>
          <button
            onClick={handleExportCSV}
            className="inline-flex h-11 items-center rounded-lg bg-navy-900 px-4 font-medium text-white transition-colors hover:bg-navy-700"
          >
            Export to CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white py-10 text-center text-slate-500 shadow-sm">Loading realtors...</div>
      ) : filteredRealtors.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-10 text-center text-slate-500 shadow-sm">No realtors found</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Brokerage</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Tags</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Orders</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRealtors.map((realtor) => (
                  <tr
                    key={realtor.id}
                    className="cursor-pointer border-b border-slate-200 hover:bg-slate-50"
                    onClick={() => {
                      window.location.href = `/admin/clients/${realtor.id}`;
                    }}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {realtor.firstName} {realtor.lastName}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{realtor.email}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{realtor.brokerageName || "-"}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {realtor.tags && realtor.tags.length > 0 ? (
                          realtor.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex rounded-full bg-navy-100 px-2.5 py-1 text-xs font-medium text-navy-900"
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {realtor.hasOutstandingBalance ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                          Outstanding
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                          Clear
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{realtor._count.orders}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{new Date(realtor.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSendPasswordReset(realtor.email)}
                          className="text-sm font-medium text-navy-900 hover:text-navy-700"
                        >
                          Reset
                        </button>
                        {realtor.phone && (
                          <button
                            onClick={() => handleSendSMS(realtor.id)}
                            disabled={sendingSMSId === realtor.id}
                            className="text-sm font-medium text-sky-700 hover:text-sky-900 disabled:opacity-50"
                          >
                            {sendingSMSId === realtor.id ? "Sending..." : "SMS"}
                          </button>
                        )}
                        <Link
                          href={`/admin/clients/${realtor.id}`}
                          className="text-sm font-medium text-sky-700 hover:text-sky-900"
                        >
                          Profile
                        </Link>
                        <button
                          onClick={() => handleToggleActive(realtor)}
                          disabled={updatingStatusId === realtor.id}
                          className={`text-sm font-medium disabled:opacity-50 ${
                            Array.isArray(realtor.tags) && realtor.tags.includes("INACTIVE")
                              ? "text-green-700 hover:text-green-900"
                              : "text-red-600 hover:text-red-900"
                          }`}
                        >
                          {updatingStatusId === realtor.id
                            ? "Saving..."
                            : Array.isArray(realtor.tags) && realtor.tags.includes("INACTIVE")
                              ? "Reactivate"
                              : "Deactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}