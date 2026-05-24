"use client";

import { useState, useEffect } from "react";

interface Sign {
  id: string;
  signNumber: string | null;
  type: string;
  status: string;
  deployedAddress: string | null;
  reports: Array<{ id: string; type: string }>;
}

interface ReportForm {
  type: "LOST" | "DAMAGED" | "OTHER";
  description: string;
}

const initialReportForm: ReportForm = {
  type: "OTHER",
  description: "",
};

export default function DashboardSignsPage() {
  const [signs, setSigns] = useState<Sign[]>([]);
  const [loading, setLoading] = useState(true);

  // Report Issue Modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedSignId, setSelectedSignId] = useState<string | null>(null);
  const [reportForm, setReportForm] = useState<ReportForm>(initialReportForm);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState("");

  // Request More Signs Modal
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [reorderForm, setReorderForm] = useState({
    quantity: 1,
    type: "",
    notes: "",
  });
  const [reorderSubmitting, setReorderSubmitting] = useState(false);
  const [reorderError, setReorderError] = useState("");

  useEffect(() => {
    fetchSigns();
  }, []);

  const fetchSigns = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/signs/mine");
      if (res.ok) {
        const data = await res.json();
        setSigns(data.signs || []);
      }
    } catch (err) {
      console.error("Error fetching signs:", err);
    } finally {
      setLoading(false);
    }
  };

  const openReportModal = (signId: string) => {
    setSelectedSignId(signId);
    setReportForm(initialReportForm);
    setReportError("");
    setShowReportModal(true);
  };

  const handleReportSubmit = async () => {
    if (!selectedSignId || !reportForm.description.trim()) {
      setReportError("Description is required");
      return;
    }

    try {
      setReportSubmitting(true);
      setReportError("");

      const res = await fetch(`/api/signs/${selectedSignId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: reportForm.type,
          description: reportForm.description,
        }),
      });

      if (res.ok) {
        alert("Report submitted successfully! Admin has been notified.");
        // Clear form after successful submission
        setReportForm(initialReportForm);
        setShowReportModal(false);
        setSelectedSignId(null);
        // Refresh signs to see updated status
        await fetchSigns();
      } else {
        const error = await res.json();
        setReportError(error.error || "Failed to submit report");
      }
    } catch (err) {
      setReportError("Failed to submit report");
      console.error(err);
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleReorderSubmit = async () => {
    if (reorderForm.quantity < 1) {
      setReorderError("Quantity must be at least 1");
      return;
    }

    try {
      setReorderSubmitting(true);
      setReorderError("");

      const res = await fetch("/api/signs/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: reorderForm.quantity,
          type: reorderForm.type || undefined,
          notes: reorderForm.notes || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        setReorderForm({ quantity: 1, type: "", notes: "" });
        setShowReorderModal(false);
      } else {
        const error = await res.json();
        setReorderError(error.error || "Failed to submit reorder");
      }
    } catch (err) {
      setReorderError("Failed to submit reorder");
      console.error(err);
    } finally {
      setReorderSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      DEPLOYED: {
        bg: "bg-blue-100",
        text: "text-blue-800",
        label: "Deployed",
      },
      DAMAGED: {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        label: "Damaged",
      },
      LOST: {
        bg: "bg-red-100",
        text: "text-red-800",
        label: "Lost",
      },
    };

    const style = styles[status] || styles.DEPLOYED;
    const isAlert = status === "DAMAGED" || status === "LOST";

    return (
      <span
        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text} ${
          isAlert ? "ring-2 ring-offset-1 ring-red-500" : ""
        }`}
      >
        {style.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Signs</h1>
          <p className="text-gray-600 mt-2">Track and manage your deployed signs</p>
        </div>

        {/* Action Buttons */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setShowReorderModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg"
          >
            + Request More Signs
          </button>
        </div>

        {/* Signs List */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading signs...</div>
          ) : signs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="mb-2">You don't have any deployed signs yet.</p>
              <button
                onClick={() => setShowReorderModal(true)}
                className="text-indigo-600 hover:text-indigo-900 font-medium"
              >
                Request signs
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                      Sign #
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                      Type
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                      Status
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                      Location
                    </th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                      Issues
                    </th>
                    <th className="text-center px-6 py-3 font-semibold text-gray-900 text-sm">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {signs.map((sign) => (
                    <tr
                      key={sign.id}
                      className={`border-b border-gray-200 hover:bg-gray-50 ${
                        sign.status === "DAMAGED" || sign.status === "LOST" ? "bg-red-50" : ""
                      }`}
                    >
                      <td className="px-6 py-4 font-mono text-gray-900 font-medium">
                        {sign.signNumber || "—"}
                      </td>
                      <td className="px-6 py-4 text-gray-700">{sign.type}</td>
                      <td className="px-6 py-4">{getStatusBadge(sign.status)}</td>
                      <td className="px-6 py-4 text-gray-700 max-w-xs truncate">
                        {sign.deployedAddress || "—"}
                      </td>
                      <td className="px-6 py-4">
                        {sign.reports.length > 0 ? (
                          <span className="inline-block px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold ring-2 ring-offset-1 ring-red-500">
                            {sign.reports.length} open
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => openReportModal(sign.id)}
                          className="text-indigo-600 hover:text-indigo-900 font-medium text-sm"
                        >
                          Report Issue
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Report Issue Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Report Sign Issue</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Issue Type
                </label>
                <select
                  value={reportForm.type}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, type: e.target.value as any })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="LOST">Lost</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Description
                </label>
                <textarea
                  placeholder="Describe what happened..."
                  value={reportForm.description}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, description: e.target.value })
                  }
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {reportError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{reportError}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportForm(initialReportForm);
                  setReportError("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReportSubmit}
                disabled={reportSubmitting}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg"
              >
                {reportSubmitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request More Signs Modal */}
      {showReorderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Request More Signs</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={reorderForm.quantity}
                  onChange={(e) =>
                    setReorderForm({ ...reorderForm, quantity: parseInt(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Sign Type (Optional)
                </label>
                <select
                  value={reorderForm.type}
                  onChange={(e) =>
                    setReorderForm({ ...reorderForm, type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Any Type</option>
                  <option value="Standard">Standard</option>
                  <option value="Rider">Rider</option>
                  <option value="Open House">Open House</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Notes
                </label>
                <textarea
                  placeholder="Any special requests..."
                  value={reorderForm.notes}
                  onChange={(e) =>
                    setReorderForm({ ...reorderForm, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {reorderError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{reorderError}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReorderModal(false);
                  setReorderForm({ quantity: 1, type: "", notes: "" });
                  setReorderError("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReorderSubmit}
                disabled={reorderSubmitting}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg"
              >
                {reorderSubmitting ? "Requesting..." : "Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
