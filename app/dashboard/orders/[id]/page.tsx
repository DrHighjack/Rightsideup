"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";

interface OrderDetail {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  address: string;
  addressLat?: number;
  addressLng?: number;
  scheduledDate?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  realtor: {
    email: string;
    firstName: string;
    lastName: string;
  };
  ticket811?: { id: string } | null;
  self811Accepted: boolean;
  photos: Array<{ id: string; name: string; uploadedAt: string; url: string }>;
}

function normalizeOrder(data: OrderDetail): OrderDetail {
  return { ...data, photos: Array.isArray(data.photos) ? data.photos : [] };
}

function calendarDateValue(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function formatCalendarDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { timeZone: "UTC" }).format(new Date(value));
}

export default function OrderDetailPage() {
  const params = useParams();
  const { data: session } = useSession();
  const id = params.id as string;
  const isSharedAccountant =
    session?.user?.role === "BROKERAGE" &&
    session?.user?.accountTitle === "Accountant";
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [creditCode, setCreditCode] = useState("");
  const [applyingCredit, setApplyingCredit] = useState(false);
  const [creditMessage, setCreditMessage] = useState("");
  const [creditError, setCreditError] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [editingDate, setEditingDate] = useState(false);
  const [requestedDate, setRequestedDate] = useState("");
  const [dateSaving, setDateSaving] = useState(false);
  const [dateError, setDateError] = useState("");

  useEffect(() => {
    async function fetchOrder() {
      try {
        const response = await fetch(`/api/orders/${id}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Unable to load order (HTTP ${response.status})`);
        }
        const data = await response.json();
        const normalizedOrder = normalizeOrder(data);
        setOrder(normalizedOrder);
        setRequestedDate(calendarDateValue(normalizedOrder.scheduledDate));
      } catch (error) {
        console.error("Error fetching order:", error);
        setLoadError(error instanceof Error ? error.message : "Unable to load order");
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [id]);

  async function handleCancel() {
    setCancelling(true);
    setCancelError("");
    try {
      const response = await fetch(`/api/orders/${id}/cancel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelReason }),
      });

      if (!response.ok) {
        let message = "Failed to cancel order";
        try {
          const data = await response.json();
          if (typeof data?.error === "string" && data.error.trim()) {
            message = data.error;
          }
        } catch {}
        throw new Error(message);
      }

      const updatedOrder = await response.json();
      setOrder(normalizeOrder(updatedOrder));
      setCancelled(true);
      setShowCancelModal(false);
    } catch (error) {
      console.error("Error cancelling order:", error);
      setCancelError(error instanceof Error ? error.message : "Failed to cancel order");
    } finally {
      setCancelling(false);
    }
  }

  async function handleApplyCredit() {
    setCreditError("");
    setCreditMessage("");

    if (!creditCode.trim()) {
      setCreditError("Enter a credit code to apply it");
      return;
    }

    try {
      setApplyingCredit(true);
      const response = await fetch(`/api/orders/${id}/coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: creditCode.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to apply credit");
      }

      const appliedAmount = data?.discount?.discountAmount ?? 0;
      setCreditMessage(
        appliedAmount > 0
          ? `Applied $${appliedAmount.toFixed(2)} credit to this order.`
          : "Credit applied."
      );
      setCreditCode("");
    } catch (error) {
      setCreditError(error instanceof Error ? error.message : "Failed to apply credit");
    } finally {
      setApplyingCredit(false);
    }
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoUploading(true);
    setPhotoError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/orders/${id}/photos`, { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to upload photo");
      setOrder((current) => current ? { ...current, photos: [...current.photos, data.photo] } : current);
      event.target.value = "";
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Failed to upload photo");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleDateSave() {
    if (!requestedDate) {
      setDateError("Select a requested date");
      return;
    }

    setDateSaving(true);
    setDateError("");
    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledDate: requestedDate }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to change requested date");
      const normalizedOrder = normalizeOrder(data);
      setOrder(normalizedOrder);
      setRequestedDate(calendarDateValue(normalizedOrder.scheduledDate));
      setEditingDate(false);
    } catch (error) {
      setDateError(error instanceof Error ? error.message : "Failed to change requested date");
    } finally {
      setDateSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-slate-500 shadow-sm">Loading...</div>;
  }

  if (!order) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center"><p className="font-semibold text-red-900">Unable to load order</p><p className="mt-2 text-sm text-red-800">{loadError || "The order could not be loaded."}</p><button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white">Try again</button></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{order.orderNumber}</h1>
          <p className="text-slate-600 mt-1">Order details and history</p>
        </div>
        <Link
          href="/dashboard/orders"
          className="inline-flex h-12 items-center rounded-lg border border-slate-300 bg-white px-5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Back to Orders
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Listing Photos</h2>
          {!isSharedAccountant && <label className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-navy-900 px-4 text-sm font-medium text-white hover:bg-navy-800">
            {photoUploading ? "Uploading..." : "Add Photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoUpload}
              disabled={photoUploading}
              className="hidden"
            />
          </label>}
        </div>
        {photoError && <p className="text-sm text-red-700">{photoError}</p>}
        {(order.photos ?? []).length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {order.photos.map((photo) => (
              <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-slate-200">
                <img src={photo.url} alt={photo.name} className="aspect-square w-full object-cover" />
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600">No photos attached to this order.</p>
        )}
      </div>

      {/* Status badge */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Status</h2>
          <span
            className={`inline-flex rounded-full px-4 py-2 font-display text-sm font-semibold uppercase tracking-widest ${
              order.status === "PENDING" || order.status === "CONFIRMED"
                ? "bg-amber-100 text-amber-800"
                : order.status === "READY_TO_SCHEDULE" || order.status === "SCHEDULED"
                ? "bg-blue-100 text-blue-800"
                : ["IN_GROUND", "EXTENDED_LISTING", "REMOVED"].includes(order.status)
                ? "bg-green-100 text-green-800"
                : order.status === "CANCELLED"
                ? "bg-red-100 text-red-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {order.status}
          </span>
        </div>
      </div>

      {/* Order details */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm sm:p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Details</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Order Type</p>
            <p className="mt-1 text-base font-medium text-slate-900">{order.type}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Created</p>
            <p className="mt-1 text-base font-medium text-slate-900 tabular-nums">
              {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Address</p>
          <a
            href={`https://maps.apple.com/?q=${encodeURIComponent(order.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-12 items-center text-base font-medium text-navy-900 underline-offset-4 hover:underline"
          >
            {order.address}
          </a>
        </div>

        {order.scheduledDate && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Requested Date</p>
              {!isSharedAccountant && ["PENDING", "CONFIRMED", "READY_TO_SCHEDULE", "SCHEDULED"].includes(order.status) && !editingDate && (
                <button
                  type="button"
                  onClick={() => setEditingDate(true)}
                  className="text-sm font-medium text-navy-900 underline-offset-4 hover:underline"
                >
                  Change Date
                </button>
              )}
            </div>
            {editingDate ? (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  type="date"
                  value={requestedDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setRequestedDate(event.target.value)}
                  className="h-11 flex-1 rounded-lg border border-slate-300 px-3 text-base text-slate-900 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
                />
                <button
                  type="button"
                  onClick={handleDateSave}
                  disabled={dateSaving}
                  className="h-11 rounded-lg bg-navy-900 px-4 font-medium text-white hover:bg-navy-800 disabled:opacity-50"
                >
                  {dateSaving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRequestedDate(calendarDateValue(order.scheduledDate));
                    setDateError("");
                    setEditingDate(false);
                  }}
                  disabled={dateSaving}
                  className="h-11 rounded-lg border border-slate-300 bg-white px-4 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <p className="mt-1 text-base font-medium text-slate-900 tabular-nums">
                {formatCalendarDate(order.scheduledDate)}
              </p>
            )}
            {dateError && <p className="mt-2 text-sm text-red-700">{dateError}</p>}
          </div>
        )}

        {order.notes && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Notes</p>
            <p className="mt-1 text-base text-slate-900">{order.notes}</p>
          </div>
        )}
      </div>

      {!isSharedAccountant && <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm sm:p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Apply Credit</h2>
        <p className="text-sm text-slate-600">Use a realtor credit code here. If the credit is larger than the order total, the remainder stays available for the next order.</p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={creditCode}
            onChange={(e) => setCreditCode(e.target.value)}
            placeholder="Enter credit code"
            className="min-h-12 flex-1 rounded-lg border border-slate-300 px-4 text-base text-slate-900 placeholder-slate-400 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
          />
          <button
            onClick={handleApplyCredit}
            disabled={applyingCredit}
            className="inline-flex h-12 items-center justify-center rounded-lg bg-navy-900 px-5 font-medium text-white transition-colors hover:bg-navy-800 disabled:opacity-50"
          >
            {applyingCredit ? "Applying..." : "Apply Credit"}
          </button>
        </div>

        {creditError && <p className="text-sm text-red-700">{creditError}</p>}
        {creditMessage && <p className="text-sm text-green-700">{creditMessage}</p>}
      </div>}

      {/* Cancel button */}
      {!isSharedAccountant && order.status === "PENDING" && !cancelled && (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => setShowCancelModal(true)}
            className="flex h-12 w-full items-center justify-center rounded-lg border border-red-300 bg-white px-4 font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/40 focus-visible:ring-offset-2"
          >
            Cancel Order
          </button>
          {!order.ticket811 && !order.self811Accepted && (
            <Link
              href={`/dashboard/811?orderId=${encodeURIComponent(order.id)}`}
              className="flex h-12 w-full items-center justify-center rounded-lg bg-navy-900 px-4 font-medium text-white transition-colors hover:bg-navy-800"
            >
              Create 811 Ticket
            </Link>
          )}
        </div>
      )}

      {/* Cancel modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-lg">
            <h3 className="font-display text-lg font-semibold tracking-tight text-slate-900">
              Are you sure you want to cancel this order?
            </h3>

            <div>
              <label htmlFor="cancelReason" className="block text-sm font-medium text-slate-700 mb-1">
                Reason (optional)
              </label>
              <textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Why are you cancelling this order?"
                rows={3}
                className="block w-full rounded-lg border border-slate-300 px-4 py-3 text-base text-slate-900 placeholder-slate-400 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
              />
            </div>

            {cancelError && (
              <p className="text-sm text-red-700">{cancelError}</p>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="inline-flex h-12 flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Keep Order
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="inline-flex h-12 flex-1 items-center justify-center rounded-lg bg-red-600 px-4 font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/40 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success message */}
      {cancelled && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Order has been cancelled successfully.
        </div>
      )}
    </div>
  );
}
