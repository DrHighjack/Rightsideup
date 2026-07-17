"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/app/components/ConfirmDialogProvider";
import { resizeImageFile } from "@/lib/client-image-resize";

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
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancelReason?: string;
  realtor: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  items: Array<{
    id: string;
    signId?: string;
    quantity: number;
    isHangingSelf: boolean;
    storagePlannedAfter?: boolean;
    sign?: {
      id: string;
      name: string;
      description?: string;
      price?: number;
    };
  }>;
}

interface Photo {
  id: string;
  url?: string;
  data?: string; // legacy base64 photos uploaded before the move to blob storage
  name: string;
  uploadedAt: string;
}

interface PhotoData {
  photos: Photo[];
  completedAt: string | null;
  techNotes: string | null;
  jobAssignmentId: string;
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const confirm = useConfirm();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<OrderDetail>>({});
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [techNotes, setTechNotes] = useState<string | null>(null);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const response = await fetch(`/api/admin/orders/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch order");
        }
        const data = await response.json();
        setOrder(data);
        setEditData(data);
      } catch (error) {
        console.error("Error fetching order:", error);
      } finally {
        setLoading(false);
      }
    }

    async function fetchPhotos() {
      try {
        const response = await fetch(`/api/admin/orders/${id}/photos`);
        if (!response.ok) {
          throw new Error("Failed to fetch photos");
        }
        const data: PhotoData = await response.json();
        setPhotos(data.photos);
        setCompletedAt(data.completedAt);
        setTechNotes(data.techNotes);
      } catch (error) {
        console.error("Error fetching photos:", error);
      }
    }

    fetchOrder();
    fetchPhotos();
  }, [id]);

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });

      if (!response.ok) {
        throw new Error("Failed to update order");
      }

      const updatedOrder = await response.json();
      setOrder(updatedOrder);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving order:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete order");
      }

      window.location.href = "/admin/orders";
    } catch (error) {
      console.error("Error deleting order:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    const ok = await confirm({
      title: "Delete photo",
      description: "Are you sure you want to delete this photo? This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    try {
      const response = await fetch(`/api/admin/orders/${id}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete photo");
      }

      const data = await response.json();
      setPhotos(data.photos);
      toast.success("Photo deleted successfully!");
    } catch (error) {
      console.error("Error deleting photo:", error);
      toast.error("Failed to delete photo");
    }
  }

  async function handleUploadPhotos() {
    if (newPhotos.length === 0) {
      toast.error("Please select at least one photo to upload");
      return;
    }

    try {
      setUploadingPhotos(true);

      const resized = await Promise.all(newPhotos.map((file) => resizeImageFile(file)));

      const formData = new FormData();
      resized.forEach((file) => formData.append("files", file));

      const response = await fetch(`/api/admin/orders/${id}/photos`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to upload photos");
      }

      const data = await response.json();
      setPhotos(data.photos);
      setNewPhotos([]);
      toast.success("Photos uploaded successfully!");
    } catch (error) {
      console.error("Error uploading photos:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload photos");
    } finally {
      setUploadingPhotos(false);
    }
  }

  if (loading) {
    return <div className="text-center text-gray-500">Loading...</div>;
  }

  if (!order) {
    return <div className="text-center text-gray-500">Order not found</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{order.orderNumber}</h1>
          <p className="text-gray-600 mt-1">Admin order details</p>
        </div>
        <Link
          href="/admin/orders"
          className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
        >
          Back to Orders
        </Link>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {!isEditing ? (
          <>
            <button
              onClick={() => setIsEditing(true)}
              className="rounded-md bg-primary px-4 py-2 text-white font-medium hover:bg-primary-dark"
            >
              Edit Order
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-md bg-red-600 px-4 py-2 text-white font-medium hover:bg-red-700"
            >
              Delete Order
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditData(order);
              }}
              className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {/* Realtor info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Realtor</h2>
          <Link
            href={`/admin/clients/${order.realtor.id}`}
            className="px-4 py-2 rounded-md bg-green-600 text-white font-medium hover:bg-green-700 text-sm"
          >
            Profile
          </Link>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            <strong>{order.realtor.firstName} {order.realtor.lastName}</strong>
          </p>
          <p className="text-sm text-gray-600">{order.realtor.email}</p>
        </div>
      </div>

      {/* Order details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">Order Details</h2>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={editData.status || ""}
                onChange={(e) =>
                  setEditData((prev) => ({ ...prev, status: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-4 py-2"
              >
                {["PENDING", "SCHEDULED", "IN_PROGRESS", "IN_GROUND", "COMPLETED", "CANCELLED"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={editData.type || ""}
                onChange={(e) => setEditData((prev) => ({ ...prev, type: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-4 py-2"
              >
                {["INSTALL", "REMOVAL", "CHANGE"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={editData.address || ""}
                onChange={(e) => setEditData((prev) => ({ ...prev, address: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-4 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scheduled Date
              </label>
              <input
                type="date"
                value={
                  editData.scheduledDate
                    ? new Date(editData.scheduledDate).toISOString().split("T")[0]
                    : ""
                }
                onChange={(e) =>
                  setEditData((prev) => ({ ...prev, scheduledDate: e.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-4 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={editData.notes || ""}
                onChange={(e) => setEditData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-4 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Notes (internal only)
              </label>
              <textarea
                value={editData.adminNotes || ""}
                onChange={(e) =>
                  setEditData((prev) => ({ ...prev, adminNotes: e.target.value }))
                }
                rows={3}
                className="w-full rounded-md border border-gray-300 px-4 py-2"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="text-gray-900 font-medium">{order.status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Type</p>
                <p className="text-gray-900 font-medium">{order.type}</p>
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

            {order.adminNotes && (
              <div>
                <p className="text-sm text-gray-600">Admin Notes</p>
                <p className="text-gray-900">{order.adminNotes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Order Items */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h2>
        
        {order.items && order.items.length > 0 ? (
          <div className="space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                {item.isHangingSelf ? (
                  <div>
                    <p className="font-medium text-gray-900">Agent to Hang Up Their Own Sign</p>
                    {item.storagePlannedAfter !== undefined && (
                      <p className="text-sm text-gray-600 mt-2">
                        {item.storagePlannedAfter ? "✓ Agent will store after listing" : "✗ Agent will not store"}
                      </p>
                    )}
                  </div>
                ) : item.sign ? (
                  <div>
                    <p className="font-medium text-gray-900">{item.sign.name}</p>
                    {item.sign.description && (
                      <p className="text-sm text-gray-600">{item.sign.description}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-gray-600">Quantity: {item.quantity}</span>
                      <span className="text-sm font-medium text-gray-900">
                        ${(150 * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Item details not available</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No items in this order</p>
        )}
      </div>

      {/* Photos Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {photos.length > 0 ? (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">📸 Job Photos ({photos.length})</h2>
              {completedAt && (
                <p className="text-sm text-gray-600">
                  Completed: {new Date(completedAt).toLocaleString()}
                </p>
              )}
            </div>

            {techNotes && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">Field Tech Notes:</p>
                <p className="text-sm text-gray-600 mt-1">{techNotes}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 mb-6">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={photo.url || photo.data}
                      alt={photo.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-gray-600 truncate">{photo.name}</p>
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="ml-1 p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Delete photo"
                    >
                      ✕
                    </button>
                  </div>
                  {photo.uploadedAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(photo.uploadedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add More Photos</h3>
            </div>
          </>
        ) : (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">📸 Job Photos</h2>
            <p className="text-gray-600 mb-4">No photos yet. Add photos below.</p>
          </div>
        )}

        {/* Add New Photos Section */}
        <div className={photos.length > 0 ? "pt-0" : ""}>
          <h3 className={photos.length > 0 ? "text-lg font-semibold text-gray-900 mb-4" : "text-lg font-semibold text-gray-900 mb-4"}>
            {photos.length > 0 ? "" : "Add Job Photos"}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Photos to Upload
              </label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  const files = Array.from(e.currentTarget.files || []);
                  setNewPhotos(files);
                }}
                disabled={uploadingPhotos}
                className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
              {newPhotos.length > 0 && (
                <p className="text-sm text-gray-600 mt-2">
                  {newPhotos.length} photo{newPhotos.length !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
            
            {newPhotos.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Preview</h4>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {newPhotos.map((file, idx) => (
                    <div key={idx} className="relative">
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs text-gray-600 truncate mt-1">{file.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleUploadPhotos}
              disabled={uploadingPhotos || newPhotos.length === 0}
              className="w-full py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploadingPhotos ? "Uploading..." : "Upload Photos"}
            </button>
          </div>
        </div>
      </div>

      {/* Audit Log */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Audit Log</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600">Created</p>
              <p className="text-gray-900 font-medium">
                {new Date(order.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600">Last Updated</p>
              <p className="text-gray-900 font-medium">
                {new Date(order.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>

          {order.cancelledAt && (
            <div className="flex justify-between items-start pt-3 border-t border-gray-200">
              <div>
                <p className="text-sm text-gray-600">Cancelled</p>
                <p className="text-gray-900 font-medium">
                  {new Date(order.cancelledAt).toLocaleString()}
                </p>
                {order.cancelReason && (
                  <p className="text-sm text-gray-700 mt-1">
                    <strong>Reason:</strong> {order.cancelReason}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Are you sure you want to delete this order?
            </h3>
            <p className="text-sm text-gray-600">This action cannot be undone.</p>

            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={saving}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-white font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
