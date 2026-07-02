"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface ActiveAgent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

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

interface PickupForm {
  signIds: string[];
  preferredDate: string;
  notes: string;
}

const initialReportForm: ReportForm = {
  type: "OTHER",
  description: "",
};

const initialPickupForm: PickupForm = {
  signIds: [],
  preferredDate: "",
  notes: "",
};

export default function DashboardSignsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role as string | undefined;
  const isTC = userRole === "TC";
  const [signs, setSigns] = useState<Sign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAgent, setActiveAgent] = useState<ActiveAgent | null>(null);

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

  // Schedule Pickup Modal
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [pickupForm, setPickupForm] = useState<PickupForm>(initialPickupForm);
  const [pickupSubmitting, setPickupSubmitting] = useState(false);
  const [pickupError, setPickupError] = useState("");

  useEffect(() => {
    if (!isTC) {
      setActiveAgent(null);
      return;
    }

    const stored = localStorage.getItem("tc_active_agent");
    if (!stored) {
      setActiveAgent(null);
      return;
    }

    try {
      setActiveAgent(JSON.parse(stored) as ActiveAgent);
    } catch (err) {
      console.error("Invalid stored agent data", err);
      localStorage.removeItem("tc_active_agent");
      setActiveAgent(null);
    }
  }, [isTC]);

  useEffect(() => {
    if (isTC && !activeAgent) {
      setSigns([]);
      setLoading(false);
      return;
    }

    fetchSigns();
  }, [isTC, activeAgent]);

  const fetchSigns = async () => {
    try {
      setLoading(true);
      const searchParams = new URLSearchParams();
      if (isTC && activeAgent?.id) {
        searchParams.set("realtorId", activeAgent.id);
      }

      const requestUrl = searchParams.size > 0
        ? `/api/signs/mine?${searchParams.toString()}`
        : "/api/signs/mine";

      const res = await fetch(requestUrl);
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

  const handlePickupSubmit = async () => {
    if (pickupForm.signIds.length === 0) {
      setPickupError("Please select at least one sign to pick up");
      return;
    }

    if (!pickupForm.preferredDate) {
      setPickupError("Please select a preferred pickup date");
      return;
    }

    try {
      setPickupSubmitting(true);
      setPickupError("");

      const res = await fetch("/api/signs/schedule-pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signIds: pickupForm.signIds,
          preferredDate: pickupForm.preferredDate,
          notes: pickupForm.notes || undefined,
          realtorId: isTC ? activeAgent?.id : undefined,
        }),
      });

      if (res.ok) {
        alert("Pickup scheduled successfully! We'll contact you to confirm.");
        setPickupForm(initialPickupForm);
        setShowPickupModal(false);
        // Refresh signs list
        await fetchSigns();
      } else {
        const error = await res.json();
        setPickupError(error.error || "Failed to schedule pickup");
      }
    } catch (err) {
      setPickupError("Failed to schedule pickup");
      console.error(err);
    } finally {
      setPickupSubmitting(false);
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
        {isTC && (
          <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
            {activeAgent ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-indigo-900">Acting for {activeAgent.firstName} {activeAgent.lastName}</p>
                  <p className="text-xs text-indigo-700">{activeAgent.email}</p>
                </div>
                <Link
                  href="/tc/select-agent"
                  className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
                >
                  Switch Agent
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-indigo-900">Select an agent to view and manage their signs.</p>
                <Link
                  href="/tc/select-agent"
                  className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
                >
                  Select Agent
                </Link>
              </div>
            )}
          </div>
        )}

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
          <button
            onClick={() => setShowPickupModal(true)}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg"
          >
            📦 Schedule Pickup
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

      {/* Schedule Pickup Modal */}
      {showPickupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-lg">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Schedule Sign Pickup</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Select Signs to Pick Up
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  {signs.length === 0 ? (
                    <p className="text-sm text-gray-500">No signs available for pickup</p>
                  ) : (
                    signs.map((sign) => (
                      <label key={sign.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pickupForm.signIds.includes(sign.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPickupForm({
                                ...pickupForm,
                                signIds: [...pickupForm.signIds, sign.id],
                              });
                            } else {
                              setPickupForm({
                                ...pickupForm,
                                signIds: pickupForm.signIds.filter((id) => id !== sign.id),
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700">
                          {sign.signNumber || "Sign"} - {sign.type} ({sign.status})
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Preferred Pickup Date *
                </label>
                <input
                  type="date"
                  value={pickupForm.preferredDate}
                  onChange={(e) =>
                    setPickupForm({ ...pickupForm, preferredDate: e.target.value })
                  }
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  placeholder="Any special instructions..."
                  value={pickupForm.notes}
                  onChange={(e) =>
                    setPickupForm({ ...pickupForm, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              {pickupError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{pickupError}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPickupModal(false);
                  setPickupForm(initialPickupForm);
                  setPickupError("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handlePickupSubmit}
                disabled={pickupSubmitting}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-medium rounded-lg"
              >
                {pickupSubmitting ? "Scheduling..." : "Schedule Pickup"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
