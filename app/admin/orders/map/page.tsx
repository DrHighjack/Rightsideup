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
}

const getMarkerColor = (order: OrderLocation): string => {
  switch (order.status) {
    case "COMPLETED":
      return "#10B981"; // Green
    case "SCHEDULED":
      return "#3B82F6"; // Blue
    case "IN_PROGRESS":
      return "#A855F7"; // Purple
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
    case "ON_HOLD":
      return "bg-orange-100 text-orange-800";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    case "PENDING":
    default:
      return "bg-yellow-100 text-yellow-800";
  }
};

export default function OrdersMapPage() {
  const [orders, setOrders] = useState<OrderLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 47.6, lng: -122.3 }); // Seattle area default
  const [error, setError] = useState("");
  const [mapKey, setMapKey] = useState("");

  useEffect(() => {
    // Get API key from environment
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (key) {
      setMapKey(key);
    }
    
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/orders/map");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);

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
            <Link
              href="/admin/orders"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              View Orders Table
            </Link>
          </div>
          <p className="text-gray-600">
            {loading ? "Loading..." : `${orders.length} order${orders.length !== 1 ? "s" : ""} with location data`}
          </p>

          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700">
              {error}
            </div>
          )}

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
      ) : (
        <div className="flex-1 relative overflow-hidden">
          <GoogleMapReact
            bootstrapURLKeys={{ key: mapKey }}
            defaultCenter={mapCenter}
            defaultZoom={8}
            margin={[50, 50, 50, 50]}
            yesIWantToUseGoogleMapApiInternals
          >
            {orders.map((order) =>
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
