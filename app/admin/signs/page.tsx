"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Sign {
  id: string;
  signNumber: string | null;
  type: string;
  status: string;
  assignedToUser: { id: string; firstName: string; lastName: string; email: string } | null;
  assignedToOrder: { id: string; orderNumber: string } | null;
  reports: Array<{ id: string; type: string }>;
}

interface SignReport {
  id: string;
  signId: string;
  sign: Sign;
  reportedByUser: { id: string; firstName: string; lastName: string; email: string };
  type: string;
  description: string;
  createdAt: string;
}

interface Summary {
  total: number;
  available: number;
  deployed: number;
  damaged: number;
  lost: number;
}

export default function AdminSignsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("signs");
  const [signs, setSigns] = useState<Sign[]>([]);
  const [reports, setReports] = useState<SignReport[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    available: 0,
    deployed: 0,
    damaged: 0,
    lost: 0,
  });

  // Filters & search
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modals
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    startNumber: "",
    type: "Standard",
    quantity: 10,
  });

  useEffect(() => {
    fetchSigns();
    fetchReports();
  }, [statusFilter, typeFilter, search]);

  const fetchSigns = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (typeFilter) params.append("type", typeFilter);
      if (search) params.append("search", search);

      const res = await fetch(`/api/admin/signs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSigns(data.signs);

        // Calculate summary
        const summaryData = {
          total: data.total,
          available: data.signs.filter((s: Sign) => s.status === "AVAILABLE").length,
          deployed: data.signs.filter((s: Sign) => s.status === "DEPLOYED").length,
          damaged: data.signs.filter((s: Sign) => s.status === "DAMAGED").length,
          lost: data.signs.filter((s: Sign) => s.status === "LOST").length,
        };
        setSummary(summaryData);
      }
    } catch (err) {
      console.error("Error fetching signs:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await fetch("/api/admin/sign-reports?resolved=false");
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error("Error fetching reports:", err);
    }
  };

  const handleBulkAdd = async () => {
    try {
      const res = await fetch("/api/admin/signs/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startNumber: bulkForm.startNumber,
          type: bulkForm.type,
          quantity: parseInt(bulkForm.quantity as unknown as string),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Successfully created ${data.created} signs!`);
        setShowBulkAddModal(false);
        setBulkForm({ startNumber: "", type: "Standard", quantity: 10 });
        fetchSigns();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (err) {
      alert("Failed to create signs");
    }
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      AVAILABLE: "bg-green-100 text-green-800",
      DEPLOYED: "text-blue-800 bg-blue-100",
      DAMAGED: "bg-yellow-100 text-yellow-800",
      LOST: "bg-red-100 text-red-800",
      RETIRED: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sign Inventory Management</h1>
          <p className="text-gray-600 mt-2">Manage physical signs and track deployment status</p>
        </div>

        {/* Summary Cards */}
        {activeTab === "signs" && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Total Signs</p>
              <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
            </div>
            <div className="bg-green-50 rounded-lg border border-green-200 p-4">
              <p className="text-sm text-green-600">Available</p>
              <p className="text-2xl font-bold text-green-900">{summary.available}</p>
            </div>
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <p className="text-sm text-blue-600">Deployed</p>
              <p className="text-2xl font-bold text-blue-900">{summary.deployed}</p>
            </div>
            <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
              <p className="text-sm text-yellow-600">Damaged</p>
              <p className="text-2xl font-bold text-yellow-900">{summary.damaged}</p>
            </div>
            <div className="bg-red-50 rounded-lg border border-red-200 p-4">
              <p className="text-sm text-red-600">Lost</p>
              <p className="text-2xl font-bold text-red-900">{summary.lost}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("signs")}
              className={`px-6 py-3 font-medium text-sm ${
                activeTab === "signs"
                  ? "text-indigo-600 border-b-2 border-indigo-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Signs Inventory
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`px-6 py-3 font-medium text-sm ${
                activeTab === "reports"
                  ? "text-indigo-600 border-b-2 border-indigo-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Open Reports ({reports.length})
            </button>
          </div>

          <div className="p-6">
            {/* Signs Tab */}
            {activeTab === "signs" && (
              <div className="space-y-4">
                {/* Controls */}
                <div className="flex flex-col gap-4">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Search by sign number or address..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => setShowBulkAddModal(true)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg"
                    >
                      Bulk Add
                    </button>
                    <a
                      href="/admin/signs/map"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg inline-block"
                    >
                      View Map
                    </a>
                  </div>

                  <div className="flex gap-3">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">All Statuses</option>
                      <option value="AVAILABLE">Available</option>
                      <option value="DEPLOYED">Deployed</option>
                      <option value="DAMAGED">Damaged</option>
                      <option value="LOST">Lost</option>
                      <option value="RETIRED">Retired</option>
                    </select>

                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">All Types</option>
                      <option value="Standard">Standard</option>
                      <option value="Rider">Rider</option>
                      <option value="Open House">Open House</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Sign #</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Type</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Status</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Assigned To</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Location</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-900">Issues</th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-gray-500">
                            Loading...
                          </td>
                        </tr>
                      ) : signs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-gray-500">
                            No signs found
                          </td>
                        </tr>
                      ) : (
                        signs.map((sign) => (
                          <tr key={sign.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-gray-900">{sign.signNumber || "—"}</td>
                            <td className="px-4 py-3 text-gray-700">{sign.type}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(sign.status)}`}>
                                {sign.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {sign.assignedToUser ? (
                                <div>
                                  <div className="font-medium">{sign.assignedToUser.firstName} {sign.assignedToUser.lastName}</div>
                                  <div className="text-xs text-gray-500">{sign.assignedToUser.email}</div>
                                </div>
                              ) : (
                                <span className="text-gray-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-700 max-w-xs truncate">—</td>
                            <td className="px-4 py-3">
                              {sign.reports.length > 0 ? (
                                <span className="inline-block px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                                  {sign.reports.length} open
                                </span>
                              ) : (
                                <span className="text-gray-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => router.push(`/admin/signs/${sign.id}`)}
                                className="text-indigo-600 hover:text-indigo-900 font-medium"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Reports Tab */}
            {activeTab === "reports" && (
              <div className="space-y-4">
                {reports.length === 0 ? (
                  <p className="text-center py-8 text-gray-500">No open reports</p>
                ) : (
                  <div className="space-y-3">
                    {reports.map((report) => (
                      <div key={report.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-gray-900">Sign {report.sign.signNumber}</p>
                            <p className="text-sm text-gray-600">{report.sign.type} • {report.sign.status}</p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded ${
                            report.type === "LOST" ? "bg-red-100 text-red-800" :
                            report.type === "DAMAGED" ? "bg-yellow-100 text-yellow-800" :
                            "bg-blue-100 text-blue-800"
                          }`}>
                            {report.type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-3">{report.description}</p>
                        <div className="text-xs text-gray-500">
                          Reported by {report.reportedByUser.firstName} {report.reportedByUser.lastName} on {new Date(report.createdAt).toLocaleDateString()}
                        </div>
                        <button
                          onClick={() => router.push(`/admin/signs/${report.signId}`)}
                          className="mt-3 text-indigo-600 hover:text-indigo-900 font-medium text-sm"
                        >
                          View Sign & Resolve →
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Add Modal */}
      {showBulkAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Bulk Add Signs</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Start Number</label>
                <input
                  type="text"
                  placeholder="e.g., SPF-S-0001"
                  value={bulkForm.startNumber}
                  onChange={(e) => setBulkForm({ ...bulkForm, startNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Sign Type</label>
                <select
                  value={bulkForm.type}
                  onChange={(e) => setBulkForm({ ...bulkForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="Standard">Standard</option>
                  <option value="Rider">Rider</option>
                  <option value="Open House">Open House</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={bulkForm.quantity}
                  onChange={(e) => setBulkForm({ ...bulkForm, quantity: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Will auto-increment from start number</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAdd}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg"
              >
                Create {bulkForm.quantity} Signs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
