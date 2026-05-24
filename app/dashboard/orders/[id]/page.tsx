"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface OrderDetail {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  address: string;
  addressLat?: number;
  addressLng?: number;
  scheduledDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  realtor: {
    email: string;
    firstName: string;
    lastName: string;
  };
}

export default function OrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const response = await fetch(`/api/orders/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch order");
        }
        const data = await response.json();
        setOrder(data);
      } catch (error) {
        console.error("Error fetching order:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [id]);

  async function handleCancel() {
    setCancelling(true);
    try {
      const response = await fetch(`/api/orders/${id}/cancel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelReason }),
      });

      if (!response.ok) {
        throw new Error("Failed to cancel order");
      }

      const updatedOrder = await response.json();
      setOrder(updatedOrder);
      setCancelled(true);
      setShowCancelModal(false);
    } catch (error) {
      console.error("Error cancelling order:", error);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return <div className="text-center text-gray-500">Loading...</div>;
  }

  if (!order) {
    return <div className="text-center text-gray-500">Order not found</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{order.orderNumber}</h1>
          <p className="text-gray-600 mt-1">Order details and history</p>
        </div>
        <Link
          href="/dashboard/orders"
          className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
        >
          Back to Orders
        </Link>
      </div>

      {/* Status badge */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Status</h2>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
              order.status === "PENDING"
                ? "bg-yellow-100 text-yellow-800"
                : order.status === "COMPLETED"
                ? "bg-green-100 text-green-800"
                : order.status === "CANCELLED"
                ? "bg-red-100 text-red-800"
                : "bg-blue-100 text-blue-800"
            }`}
          >
            {order.status}
          </span>
        </div>
      </div>

      {/* Order details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Details</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Order Type</p>
            <p className="text-gray-900 font-medium">{order.type}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Created</p>
            <p className="text-gray-900 font-medium">
              {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-600">Address</p>
          <p className="text-gray-900 font-medium">{order.address}</p>
        </div>

        {order.scheduledDate && (
          <div>
            <p className="text-sm text-gray-600">Scheduled Date</p>
            <p className="text-gray-900 font-medium">
              {new Date(order.scheduledDate).toLocaleDateString()}
            </p>
          </div>
        )}

        {order.notes && (
          <div>
            <p className="text-sm text-gray-600">Notes</p>
            <p className="text-gray-900">{order.notes}</p>
          </div>
        )}
      </div>

      {/* Cancel button */}
      {order.status === "PENDING" && !cancelled && (
        <button
          onClick={() => setShowCancelModal(true)}
          className="w-full rounded-md bg-red-600 px-4 py-2 text-white font-medium hover:bg-red-700"
        >
          Cancel Order
        </button>
      )}

      {/* Cancel modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Are you sure you want to cancel this order?
            </h3>

            <div>
              <label htmlFor="cancelReason" className="block text-sm font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Why are you cancelling this order?"
                rows={3}
                className="w-full rounded-md border border-gray-300 px-4 py-2"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 font-medium hover:bg-gray-50"
              >
                Keep Order
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-white font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success message */}
      {cancelled && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-800">
          Order has been cancelled successfully.
        </div>
      )}
    </div>
  );
}
