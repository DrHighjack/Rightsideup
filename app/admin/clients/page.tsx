"use client";

import { useEffect, useState } from "react";
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
  _count: {
    orders: number;
  };
}

export default function AdminClientsPage() {
  const [realtors, setRealtors] = useState<RealtorData[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "has-balance" | "no-balance">("all");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [clientsWithInvoices, setClientsWithInvoices] = useState<Map<string, boolean>>(new Map());
  const [sendingSMSId, setSendingSMSId] = useState<string | null>(null);

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

        setRealtors(data.users);
        setTotalPages(data.pagination.pages);

        // Extract all unique tags
        const tags = new Set<string>();
        data.users.forEach((user: RealtorData) => {
          if (user.tags && Array.isArray(user.tags)) {
            user.tags.forEach(tag => tags.add(tag));
          }
        });
        setAllTags(Array.from(tags).sort());

        // Fetch invoice data for balance filtering
        const invoiceMap = new Map<string, boolean>();
        for (const user of data.users) {
          try {
            const invRes = await fetch(`/api/admin/invoices?realtorId=${user.id}`);
            if (invRes.ok) {
              const invData = await invRes.json();
              const invoices = invData.invoices || [];
              const hasBalance = invoices.some((inv: any) => inv.total - inv.paid > 0);
              invoiceMap.set(user.id, hasBalance);
            }
          } catch (err) {
            console.error("Failed to fetch invoices for user:", user.id);
          }
        }
        setClientsWithInvoices(invoiceMap);
      } catch (error) {
        console.error("Failed to fetch realtors:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRealtors();
  }, [page, search]);

  const filteredRealtors = realtors.filter((realtor) => {
    // Tag filter
    if (selectedTag && (!realtor.tags || !realtor.tags.includes(selectedTag))) {
      return false;
    }

    // Balance filter
    if (balanceFilter === "has-balance" && !clientsWithInvoices.get(realtor.id)) {
      return false;
    }
    if (balanceFilter === "no-balance" && clientsWithInvoices.get(realtor.id)) {
      return false;
    }

    return true;
  });

  const handleExportCSV = () => {
    if (filteredRealtors.length === 0) {
      alert("No realtors to export");
      return;
    }

    // Prepare CSV data
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

    // Create CSV content
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => {
            // Escape quotes and wrap in quotes if contains comma
            const str = String(cell);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(",")
      ),
    ].join("\n");

    // Download CSV
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Realtor Accounts</h1>
        <p className="text-gray-600">Manage realtor accounts and view their order history</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        {/* Search */}
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            id="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, email, brokerage, or tags..."
            className="w-full rounded-md border border-gray-300 px-4 py-2"
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-4">
          {/* Tag Filter */}
          <div>
            <label htmlFor="tag-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Tag
            </label>
            <select
              id="tag-filter"
              value={selectedTag}
              onChange={(e) => {
                setSelectedTag(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-300 px-4 py-2"
            >
              <option value="">All Tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          {/* Balance Filter */}
          <div>
            <label htmlFor="balance-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Outstanding Balance
            </label>
            <select
              id="balance-filter"
              value={balanceFilter}
              onChange={(e) => {
                setBalanceFilter(e.target.value as any);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-300 px-4 py-2"
            >
              <option value="all">All Clients</option>
              <option value="has-balance">Has Outstanding Balance</option>
              <option value="no-balance">No Outstanding Balance</option>
            </select>
          </div>
        </div>

        {/* Export Button */}
        <div>
          <button
            onClick={handleExportCSV}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            Export to CSV
          </button>
        </div>
      </div>

      {/* Realtors table */}
      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading realtors...</div>
      ) : filteredRealtors.length === 0 ? (
        <div className="text-center text-gray-500 py-8">No realtors found</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Brokerage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Tags
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Orders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRealtors.map((realtor) => (
                  <tr
                    key={realtor.id}
                    className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                    onClick={() => (window.location.href = `/admin/clients/${realtor.id}`)}
                  >
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {realtor.firstName} {realtor.lastName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {realtor.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {realtor.brokerageName || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {realtor.tags && realtor.tags.length > 0 ? (
                          realtor.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {realtor._count.orders}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(realtor.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSendPasswordReset(realtor.email)}
                          className="text-indigo-600 hover:text-indigo-900 font-medium text-sm"
                        >
                          Reset
                        </button>
                        {realtor.phone && (
                          <button
                            onClick={() => handleSendSMS(realtor.id)}
                            disabled={sendingSMSId === realtor.id}
                            className="text-blue-600 hover:text-blue-900 font-medium text-sm disabled:opacity-50"
                          >
                            {sendingSMSId === realtor.id ? "Sending..." : "SMS"}
                          </button>
                        )}
                        <a href={`/admin/clients/${realtor.id}`} className="text-blue-600 hover:text-blue-900 font-medium text-sm">
                          View
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
