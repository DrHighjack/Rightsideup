"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import GoogleMapReact from "google-map-react";

interface OrderData {
  id: string;
  orderNumber: string;
  address: string;
  type: string;
  status: string;
  scheduledDate?: string;
  createdAt: string;
  addressLat?: number | null;
  addressLng?: number | null;
  mapPhotoData?: string | null;
  mapPhotoName?: string | null;
  realtor?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

interface DashboardStats {
  active: number;
  completedThisMonth: number;
  pending: number;
  recentOrders: OrderData[];
  allOrders: OrderData[];
}

const getMarkerColor = (status: string): string => {
  switch (status) {
    case "COMPLETED":
    case "IN_GROUND":
      return "#10B981";
    case "SCHEDULED":
      return "#3B82F6";
    case "IN_PROGRESS":
      return "#8B5CF6";
    case "ON_HOLD":
      return "#F97316";
    case "CANCELLED":
      return "#EF4444";
    case "PENDING":
    default:
      return "#F59E0B";
  }
};

const STATUS_FILTER_ORDER = [
  "PENDING",
  "SCHEDULED",
  "ON_HOLD",
  "IN_PROGRESS",
  "IN_GROUND",
  "COMPLETED",
  "CANCELLED",
] as const;

const formatStatusLabel = (status: string): string => status.replace(/_/g, " ");

const OrderMarker = (props: {
  order: OrderData;
  selected: boolean;
  onClick: () => void;
  [key: string]: any;
}) => {
  const { order, selected, onClick } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${order.orderNumber} - ${order.address}`}
      className="cursor-pointer"
      aria-label={`Order ${order.orderNumber}`}
    >
      <span
        style={{
          display: "block",
          width: 18,
          height: 18,
          borderRadius: "50%",
          backgroundColor: getMarkerColor(order.status),
          border: selected ? "3px solid #111827" : "2px solid rgba(255,255,255,0.95)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
};

const resolvePhotoSrc = (raw?: string | null): string | null => {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:image/")) {
    return trimmed;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `data:image/jpeg;base64,${trimmed}`;
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats>({
    active: 0,
    completedThisMonth: 0,
    pending: 0,
    recentOrders: [],
    allOrders: [],
  });
  const [loading, setLoading] = useState(true);
  const [readyCardHidden, setReadyCardHidden] = useState(false);
  const [mapKey, setMapKey] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 47.6, lng: -122.3 });
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    () => new Set(STATUS_FILTER_ORDER)
  );
  const [selectedRealtorId, setSelectedRealtorId] = useState<string>("ALL");

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (key) {
      setMapKey(key);
    }

    try {
      const dismissed = sessionStorage.getItem("dashboard_ready_order_hidden") === "1";
      if (dismissed) {
        setReadyCardHidden(true);
      }
    } catch (_err) {
      // Ignore storage access issues.
    }
  }, []);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/orders?limit=200");
        const data = await response.json();

        if (data.orders) {
          const allOrders: OrderData[] = Array.isArray(data.orders) ? data.orders : [];
          const active = data.orders.filter(
            (o: OrderData) => o.status === "SCHEDULED" || o.status === "IN_PROGRESS"
          ).length;
          const completedThisMonth = data.orders.filter((o: OrderData) => {
            if (o.status !== "COMPLETED" && o.status !== "IN_GROUND") return false;
            const orderDate = new Date(o.createdAt);
            const now = new Date();
            return (
              orderDate.getMonth() === now.getMonth() &&
              orderDate.getFullYear() === now.getFullYear()
            );
          }).length;
          const pending = data.orders.filter(
            (o: OrderData) => o.status === "PENDING"
          ).length;

          setStats({
            active,
            completedThisMonth,
            pending,
            recentOrders: allOrders.slice(0, 5),
            allOrders,
          });

          const mappedOrders = allOrders.filter(
            (order) => order.addressLat !== null && order.addressLat !== undefined && order.addressLng !== null && order.addressLng !== undefined
          );
          if (mappedOrders.length > 0) {
            const firstMapped = mappedOrders[0];
            setMapCenter({
              lat: Number(firstMapped.addressLat),
              lng: Number(firstMapped.addressLng),
            });
            setSelectedOrderId(firstMapped.id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const realtorName = session?.user?.name || "Realtor";

  const mappedOrders = useMemo(
    () =>
      stats.allOrders.filter(
        (order) => order.addressLat !== null && order.addressLat !== undefined && order.addressLng !== null && order.addressLng !== undefined
      ),
    [stats.allOrders]
  );

  const statusOptions = useMemo(() => {
    const uniqueStatuses = Array.from(new Set(mappedOrders.map((order) => order.status)));
    return uniqueStatuses.sort((a, b) => {
      const aIndex = STATUS_FILTER_ORDER.indexOf(a as (typeof STATUS_FILTER_ORDER)[number]);
      const bIndex = STATUS_FILTER_ORDER.indexOf(b as (typeof STATUS_FILTER_ORDER)[number]);

      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [mappedOrders]);

  const realtorOptions = useMemo(() => {
    const uniqueRealtors = new Map<string, string>();

    mappedOrders.forEach((order) => {
      if (order.realtor?.id) {
        const fullName = `${order.realtor.firstName || ""} ${order.realtor.lastName || ""}`.trim();
        uniqueRealtors.set(order.realtor.id, fullName || "Unnamed Realtor");
      }
    });

    return Array.from(uniqueRealtors.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [mappedOrders]);

  const filteredMappedOrders = useMemo(
    () =>
      mappedOrders.filter((order) => {
        const statusMatch = selectedStatuses.has(order.status);
        const realtorMatch =
          selectedRealtorId === "ALL" || order.realtor?.id === selectedRealtorId;

        return statusMatch && realtorMatch;
      }),
    [mappedOrders, selectedStatuses, selectedRealtorId]
  );

  const selectedOrder = useMemo(
    () => filteredMappedOrders.find((order) => order.id === selectedOrderId) || null,
    [filteredMappedOrders, selectedOrderId]
  );

  useEffect(() => {
    if (filteredMappedOrders.length === 0) {
      if (selectedOrderId !== null) {
        setSelectedOrderId(null);
      }
      return;
    }

    const selectedStillVisible = filteredMappedOrders.some((order) => order.id === selectedOrderId);
    if (!selectedStillVisible) {
      setSelectedOrderId(filteredMappedOrders[0].id);
    }
  }, [filteredMappedOrders, selectedOrderId]);

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const dismissReadyCard = () => {
    setReadyCardHidden(true);
    try {
      sessionStorage.setItem("dashboard_ready_order_hidden", "1");
    } catch (_err) {
      // Ignore storage access issues.
    }
  };

  if (loading) {
    return <div className="text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {realtorName.split(" ")[0]}
        </h1>
        <p className="text-gray-600">Here's what's happening with your orders.</p>
      </div>

      {/* Ready to order CTA */}
      {!readyCardHidden && (
        <div className="relative bg-primary-light rounded-lg border border-primary p-6 text-center">
          <button
            type="button"
            onClick={dismissReadyCard}
            className="absolute right-3 top-3 h-7 w-7 rounded-full border border-primary/40 text-primary hover:bg-white"
            aria-label="Hide ready to place order card"
            title="Hide for this session"
          >
            x
          </button>

          <h3 className="text-lg font-semibold text-primary mb-2">Ready to place an order?</h3>
          <Link
            href="/dashboard/orders/new"
            className="inline-block rounded-md bg-primary px-6 py-2 text-white font-medium hover:bg-primary-dark"
          >
            Place New Order
          </Link>
        </div>
      )}

      {/* Orders map */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Post Maps</h2>
          <span className="text-sm text-gray-600">
            {filteredMappedOrders.length} shown / {mappedOrders.length} mapped
          </span>
        </div>

        {!mapKey ? (
          <div className="h-[420px] rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
            NEXT_PUBLIC_GOOGLE_MAPS_KEY is not configured.
          </div>
        ) : mappedOrders.length === 0 ? (
          <div className="h-[420px] rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-600">
            No orders with map coordinates yet.
          </div>
        ) : filteredMappedOrders.length === 0 ? (
          <div className="h-[420px] rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-600">
            No map posts match the selected filters.
          </div>
        ) : (
          <div className="h-[420px] rounded-lg overflow-hidden border border-gray-200 relative">
            <GoogleMapReact
              bootstrapURLKeys={{ key: mapKey }}
              defaultCenter={mapCenter}
              defaultZoom={9}
              onChildClick={(key) => setSelectedOrderId(String(key))}
            >
              {filteredMappedOrders.map((order) => (
                <OrderMarker
                  key={order.id}
                  lat={Number(order.addressLat)}
                  lng={Number(order.addressLng)}
                  order={order}
                  selected={selectedOrderId === order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                />
              ))}
            </GoogleMapReact>

            {selectedOrder && (
              <div className="absolute bottom-4 left-4 w-80 max-w-[calc(100%-2rem)] rounded-lg bg-white shadow-lg border border-gray-200 p-4">
                <p className="font-semibold text-gray-900">{selectedOrder.orderNumber}</p>
                <p className="text-sm text-gray-600 mt-1">{selectedOrder.address}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedOrder.type} · {formatStatusLabel(selectedOrder.status)}
                </p>
                {selectedOrder.scheduledDate && (
                  <p className="text-sm text-gray-600 mt-1">
                    Scheduled: {new Date(selectedOrder.scheduledDate).toLocaleDateString()}
                  </p>
                )}
                {resolvePhotoSrc(selectedOrder.mapPhotoData) && (
                  <div className="mt-3 overflow-hidden rounded-md border border-gray-200">
                    <img
                      src={resolvePhotoSrc(selectedOrder.mapPhotoData) || ""}
                      alt={selectedOrder.mapPhotoName || `Photo for ${selectedOrder.orderNumber}`}
                      className="h-32 w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="mt-3">
                  <Link
                    href={`/dashboard/orders/${selectedOrder.id}`}
                    className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    View order
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {mappedOrders.length > 0 && (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {statusOptions.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggleStatus(status)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      selectedStatuses.has(status)
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-blue-300"
                    }`}
                  >
                    {formatStatusLabel(status)}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 md:ml-4 md:justify-end">
                <label htmlFor="map-realtor-filter" className="text-xs font-medium text-gray-700">
                  Realtor
                </label>
                <select
                  id="map-realtor-filter"
                  value={selectedRealtorId}
                  onChange={(e) => setSelectedRealtorId(e.target.value)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700"
                >
                  <option value="ALL">All Realtors</option>
                  {realtorOptions.map((realtor) => (
                    <option key={realtor.id} value={realtor.id}>
                      {realtor.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">Active Orders</p>
          <p className="text-3xl font-bold text-primary mt-2">{stats.active}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">Completed This Month</p>
          <p className="text-3xl font-bold text-primary mt-2">{stats.completedThisMonth}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">Pending</p>
          <p className="text-3xl font-bold text-primary mt-2">{stats.pending}</p>
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
          <Link
            href="/dashboard/orders"
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Jump to My Orders
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                  Order #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="text-primary hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 truncate">
                    {order.address}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{order.type}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        order.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-800"
                          : order.status === "IN_GROUND"
                          ? "bg-blue-100 text-blue-800"
                          : order.status === "COMPLETED"
                          ? "bg-green-100 text-green-800"
                          : order.status === "CANCELLED"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-200 px-6 py-4">
          <Link
            href="/dashboard/orders"
            className="text-sm font-medium text-primary hover:text-primary-dark"
          >
            View all orders →
          </Link>
        </div>
      </div>
    </div>
  );
}
