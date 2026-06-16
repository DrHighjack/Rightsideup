"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

interface Sign {
  id: string;
  signNumber: string | null;
  type: string;
  status: string;
  deployedAddress: string | null;
  deployedLat: number | null;
  deployedLng: number | null;
  assignedToUserId: string | null;
  assignedToUser: { id: string; firstName: string; lastName: string; email: string } | null;
  assignedToOrderId: string | null;
  assignedToOrder: { id: string; orderNumber: string } | null;
  notes: string | null;
  reports: Array<{
    id: string;
    type: string;
    description: string;
    reportedByUser: { firstName: string; lastName: string; email: string };
    createdAt: string;
    resolvedAt: string | null;
  }>;
}

interface Realtor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export default function SignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const signId = params.id as string;

  const [sign, setSign] = useState<Sign | null>(null);
  const [realtors, setRealtors] = useState<Realtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    type: "",
    status: "",
    deployedAddress: "",
    deployedLat: "",
    deployedLng: "",
    assignedToUserId: "",
    notes: "",
  });

  useEffect(() => {
    fetchSign();
    fetchRealtors();
  }, [signId]);

  const fetchSign = async () => {
    try {
      const res = await fetch(`/api/admin/signs/${signId}`);
      if (res.ok) {
        const data = await res.json();
        setSign(data);
        setForm({
          type: data.type || "",
          status: data.status || "AVAILABLE",
          deployedAddress: data.deployedAddress || "",
          deployedLat: data.deployedLat?.toString() || "",
          deployedLng: data.deployedLng?.toString() || "",
          assignedToUserId: data.assignedToUserId || "",
          notes: data.notes || "",
        });
      }
    } catch (err) {
      console.error("Error fetching sign:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRealtors = async () => {
    try {
      const res = await fetch("/api/admin/realtors");
      if (res.ok) {
        const data = await res.json();
        setRealtors(data.realtors || []);
      }
    } catch (err) {
      console.error("Error fetching realtors:", err);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setForm((prev) => {
      const updated = { ...prev, status: newStatus };

      // If changing to AVAILABLE, clear deployment data
      if (newStatus === "AVAILABLE") {
        updated.deployedAddress = "";
        updated.deployedLat = "";
        updated.deployedLng = "";
        updated.assignedToUserId = "";
      }

      return updated;
    });

    // Clear errors when status changes
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (form.status === "DEPLOYED") {
      if (!form.deployedAddress.trim()) {
        newErrors.deployedAddress = "Address is required when status is DEPLOYED";
      }
      if (!form.assignedToUserId) {
        newErrors.assignedToUserId = "Realtor assignment is required when status is DEPLOYED";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      // Build update payload
      const updateData: any = {
        type: form.type,
        status: form.status,
        notes: form.notes,
      };

      // Only include deployment fields if DEPLOYED
      if (form.status === "DEPLOYED") {
        updateData.deployedAddress = form.deployedAddress;
        updateData.deployedLat = form.deployedLat ? parseFloat(form.deployedLat) : null;
        updateData.deployedLng = form.deployedLng ? parseFloat(form.deployedLng) : null;
        updateData.assignedToUserId = form.assignedToUserId;
      } else if (form.status === "AVAILABLE") {
        // Explicitly clear deployment data for AVAILABLE
        updateData.deployedAddress = null;
        updateData.deployedLat = null;
        updateData.deployedLng = null;
        updateData.assignedToUserId = null;
        updateData.assignedToOrderId = null;
      }

      const res = await fetch(`/api/admin/signs/${signId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        alert("Sign updated successfully!");
        await fetchSign();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (err) {
      alert("Failed to save sign");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleResolveReport = async (reportId: string) => {
    if (!confirm("Mark this report as resolved?")) return;

    try {
      const res = await fetch(`/api/admin/sign-reports/${reportId}/resolve`, {
        method: "PUT",
      });

      if (res.ok) {
        alert("Report resolved!");
        await fetchSign();
      } else {
        alert("Failed to resolve report");
      }
    } catch (err) {
      alert("Error resolving report");
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  if (!sign) {
    return <div className="p-6 text-center text-gray-500">Sign not found</div>;
  }

  const isDeployed = form.status === "DEPLOYED";
  const isAvailable = form.status === "AVAILABLE";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-indigo-600 hover:text-indigo-900 font-medium text-sm mb-4"
          >
            ← Back to Inventory
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Sign {sign.signNumber}</h1>
          <p className="text-gray-600 mt-1">{sign.type}</p>
        </div>

        {/* Main Form */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 space-y-6">
          {/* Sign Info Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Sign Number</label>
              <input
                type="text"
                value={sign.signNumber || ""}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="Standard">Standard</option>
                <option value="Rider">Rider</option>
                <option value="Open House">Open House</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="AVAILABLE">Available</option>
              <option value="DEPLOYED">Deployed</option>
              <option value="DAMAGED">Damaged</option>
              <option value="LOST">Lost</option>
              <option value="RETIRED">Retired</option>
            </select>
            {isAvailable && (
              <p className="text-sm text-blue-600 mt-2">
                ℹ️ Sign is in inventory. Deployment fields will be cleared when saved.
              </p>
            )}
          </div>

          {/* Deployment Section (only show if DEPLOYED) */}
          {isDeployed && (
            <div className="border-t border-gray-200 pt-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Deployment Details</h3>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Deployed Address {isDeployed && <span className="text-red-600">*</span>}
                </label>
                <input
                  type="text"
                  placeholder="e.g., 123 Main St, Springfield, IL 62701"
                  value={form.deployedAddress}
                  onChange={(e) =>
                    setForm({ ...form, deployedAddress: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.deployedAddress
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                />
                {errors.deployedAddress && (
                  <p className="text-sm text-red-600 mt-1">{errors.deployedAddress}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="e.g., 39.7817"
                    value={form.deployedLat}
                    onChange={(e) =>
                      setForm({ ...form, deployedLat: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="e.g., -89.6501"
                    value={form.deployedLng}
                    onChange={(e) =>
                      setForm({ ...form, deployedLng: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Assigned Realtor {isDeployed && <span className="text-red-600">*</span>}
                </label>
                <select
                  value={form.assignedToUserId}
                  onChange={(e) =>
                    setForm({ ...form, assignedToUserId: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    errors.assignedToUserId
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                >
                  <option value="">Select a realtor...</option>
                  {realtors.map((realtor) => (
                    <option key={realtor.id} value={realtor.id}>
                      {realtor.firstName} {realtor.lastName} ({realtor.email})
                    </option>
                  ))}
                </select>
                {errors.assignedToUserId && (
                  <p className="text-sm text-red-600 mt-1">{errors.assignedToUserId}</p>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Notes
            </label>
            <textarea
              placeholder="Admin notes, condition details, etc."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Reports Section */}
        {sign.reports.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Sign Reports</h2>
            <div className="space-y-4">
              {sign.reports.map((report) => (
                <div
                  key={report.id}
                  className={`border rounded-lg p-4 ${
                    report.resolvedAt
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{report.type}</p>
                      <p className="text-sm text-gray-600">
                        Reported by {report.reportedByUser.firstName}{" "}
                        {report.reportedByUser.lastName} on{" "}
                        {new Date(report.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        report.resolvedAt
                          ? "bg-green-200 text-green-800"
                          : "bg-red-200 text-red-800"
                      }`}
                    >
                      {report.resolvedAt ? "Resolved" : "Open"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">{report.description}</p>
                  {!report.resolvedAt && (
                    <button
                      onClick={() => handleResolveReport(report.id)}
                      className="text-sm text-red-600 hover:text-red-900 font-medium"
                    >
                      Mark as Resolved
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
