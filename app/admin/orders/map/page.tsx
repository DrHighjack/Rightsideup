"use client";

import { useEffect, useState } from "react";
import GoogleMapReact from "google-map-react";
import Link from "next/link";

interface OrderLocation {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  address: string;
  addressLat: number | null;
  addressLng: number | null;
  realtor: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  scheduledDate: string | null;
  photoData?: string | null;
  photoName?: string | null;
}

const getMarkerColor = (order: OrderLocation): string => {
  switch (order.status) {
    case "COMPLETED":
      return "#10B981"; // Green
    case "SCHEDULED":
      return "#3B82F6"; // Blue
    case "IN_PROGRESS":
      return "#A855F7"; // Purple
    case "IN_GROUND":
      return "#06B6D4"; // Cyan
    case "ON_HOLD":
      return "#F97316"; // Orange
    case "CANCELLED":
      return "#EF4444"; // Red
    case "PENDING":
    default:
      return "#FBBF24"; // Yellow
  }
};

const OrderMarker = (props: { order: OrderLocation; isSelected: boolean; onClick: () => void; [key: string]: any }) => {
  const { order, isSelected, onClick } = props;
  return (
  <div
    onClick={onClick}
    className="cursor-pointer transition-transform hover:scale-125"
    title={`${order.orderNumber} - ${order.address}`}
  >
    <div
      style={{
        width: 28,
        height: 28,
        backgroundColor: getMarkerColor(order),
        border: isSelected ? "3px solid white" : "2px solid rgba(0,0,0,0.3)",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: isSelected ? "0 0 0 3px rgba(0,0,0,0.4)" : "0 2px 4px rgba(0,0,0,0.3)",
      }}
    />
  </div>
  );
};

const getStatusLabel = (status: string): string => {
  return status.replace(/_/g, " ");
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case "COMPLETED":
      return "bg-green-100 text-green-800";
    case "SCHEDULED":
      return "bg-blue-100 text-blue-800";
    case "IN_PROGRESS":
      return "bg-purple-100 text-purple-800";
    case "IN_GROUND":
      return "bg-cyan-100 text-cyan-800";
    case "ON_HOLD":
      return "bg-orange-100 text-orange-800";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    case "PENDING":
    default:
      return "bg-yellow-100 text-yellow-800";
  }
};

const STATUS_OPTIONS = ['PENDING', 'SCHEDULED', 'ON_HOLD', 'IN_PROGRESS', 'IN_GROUND', 'COMPLETED', 'CANCELLED'] as const;

export default function OrdersMapPage() {
  const [orders, setOrders] = useState<OrderLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 47.6, lng: -122.3 }); // Seattle area default
  const [error, setError] = useState("");
  const [mapKey, setMapKey] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(STATUS_OPTIONS));

  useEffect(() => {
    // Get API key from environment
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (key) {
      setMapKey(key);
    }
    
    fetchOrders();

    // Refresh data when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchOrders();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/orders/map");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setSelectedMarker(null); // Clear selection to show fresh data

        // Set map center to first order if available
        if (data.orders && data.orders.length > 0) {
          const firstOrder = data.orders[0];
          if (firstOrder.addressLat && firstOrder.addressLng) {
            setMapCenter({
              lat: parseFloat(String(firstOrder.addressLat)),
              lng: parseFloat(String(firstOrder.addressLng)),
            });
          }
        }
      } else {
        setError("Failed to load orders");
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError("Error loading map data");
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = (status: string) => {
    const newStatuses = new Set(selectedStatuses);
    if (newStatuses.has(status)) {
      newStatuses.delete(status);
    } else {
      newStatuses.add(status);
    }
    setSelectedStatuses(newStatuses);
  };

  const toggleAllStatuses = () => {
    if (selectedStatuses.size === STATUS_OPTIONS.length) {
      setSelectedStatuses(new Set());
    } else {
      setSelectedStatuses(new Set(STATUS_OPTIONS));
    }
  };

  const filteredOrders = orders.filter((order) => selectedStatuses.has(order.status));

  if (!mapKey) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Orders Map</h1>
          <div className="p-8 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 font-medium">
              Error: NEXT_PUBLIC_GOOGLE_MAPS_KEY is not configured
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 md:p-6 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Orders Map</h1>
            <div className="flex gap-2">
              <button
                onClick={fetchOrders}
                disabled={loading}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <Link
                href="/admin/orders"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                View Orders Table
              </Link>
            </div>
          </div>
          <p className="text-gray-600">
            {loading ? "Loading..." : `${orders.length} order${orders.length !== 1 ? "s" : ""} with location data`}
          </p>

          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700">
              {error}
            </div>
          )}

          {/* Filter Section */}
          <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Filter by Status</h3>
              <button
                onClick={toggleAllStatuses}
                className="text-sm px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded transition"
              >
                {selectedStatuses.size === STATUS_OPTIONS.length ? "Clear All" : "Select All"}
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {STATUS_OPTIONS.map((status) => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.has(status)}
                    onChange={() => toggleStatus(status)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor:
                          status === "COMPLETED"
                            ? "#10B981"
                            : status === "SCHEDULED"
                            ? "#3B82F6"
                            : status === "IN_PROGRESS"
                            ? "#A855F7"
                            : status === "ON_HOLD"
                            ? "#F97316"
                            : status === "CANCELLED"
                            ? "#EF4444"
                            : status === "IN_GROUND"
                            ? "#06B6D4"
                            : "#FBBF24",
                      }}
                    ></div>
                    <span className="text-sm text-gray-700">{status.replace(/_/g, " ")}</span>
                  </div>
                </label>
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-3">
              Showing {filteredOrders.length} of {orders.length} orders
            </p>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: "#10B981" }}
              ></div>
              <span className="text-gray-700">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: "#3B82F6" }}
              ></div>
              <span className="text-gray-700">Scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: "#A855F7" }}
              ></div>
              <span className="text-gray-700">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: "#F97316" }}
              ></div>
              <span className="text-gray-700">On Hold</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: "#06B6D4" }}
              ></div>
              <span className="text-gray-700">In Ground</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: "#FBBF24" }}
              ></div>
              <span className="text-gray-700">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: "#EF4444" }}
              ></div>
              <span className="text-gray-700">Cancelled</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map Container */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center bg-gray-100">
          <p className="text-gray-600">Loading map...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-gray-100">
          <p className="text-gray-600">No orders with location data found</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-gray-100">
          <p className="text-gray-600">No orders match the selected filters</p>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden">
          <GoogleMapReact
            bootstrapURLKeys={{ key: mapKey }}
            defaultCenter={mapCenter}
            defaultZoom={8}
            margin={[50, 50, 50, 50]}
            yesIWantToUseGoogleMapApiInternals
          >
            {filteredOrders.map((order) =>
              order.addressLat && order.addressLng ? (
                <OrderMarker
                  key={order.id}
                  lat={parseFloat(String(order.addressLat))}
                  lng={parseFloat(String(order.addressLng))}
                  order={order}
                  isSelected={selectedMarker === order.id}
                  onClick={() => setSelectedMarker(selectedMarker === order.id ? null : order.id)}
                />
              ) : null
            )}
          </GoogleMapReact>

          {/* Info Panel */}
          {selectedMarker && (
            <div className="absolute bottom-6 left-6 bg-white rounded-lg shadow-lg p-4 w-72 max-h-96 overflow-y-auto">
              {(() => {
                const order = orders.find((o) => o.id === selectedMarker);
                if (!order) return null;

                return (
                  <div>
                    <h3 className="font-bold text-lg mb-3">{order.orderNumber}</h3>

                    {/* Photo Section */}
                    {order.photoData && (
                      <div className="mb-4 border border-gray-300 rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={order.photoData}
                          alt={order.photoName || "Order photo"}
                          className="w-full h-48 object-cover"
                        />
                      </div>
                    )}

                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-gray-500">Address</p>
                        <p className="font-medium">{order.address}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Status</p>
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusColor(
                            order.status
                          )}`}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                      </div>

                      <div>
                        <p className="text-gray-500">Type</p>
                        <p className="font-medium">{order.type}</p>
                      </div>

                      <div>
                        <p className="text-gray-500">Client</p>
                        <p className="font-medium">
                          {order.realtor.firstName} {order.realtor.lastName}
                        </p>
                      </div>

                      {order.scheduledDate && (
                        <div>
                          <p className="text-gray-500">Scheduled Date</p>
                          <p className="font-medium">
                            {new Date(order.scheduledDate).toLocaleDateString()}
                          </p>
                        </div>
                      )}

                      <div className="pt-2 mt-3 border-t">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          View Details →
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
