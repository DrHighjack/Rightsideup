"use client";

import { useEffect, useState } from "react";
import { APIProvider, Map, AdvancedMarker, InfoWindow } from "@vis.gl/react-google-maps";
import Link from "next/link";

interface SignLocation {
  id: string;
  signNumber: string | null;
  type: string;
  status: string;
  deployedAddress: string | null;
  deployedLat: number | null;
  deployedLng: number | null;
  assignedToUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  assignedToOrder: {
    id: string;
    orderNumber: string;
  } | null;
  reports: Array<{ id: string; type: string }>;
}

const getMapsApiKey = (): string => {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key) {
    throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_KEY is not defined");
  }
  return key;
};

const getMarkerColor = (sign: SignLocation): string => {
  // Red for LOST status
  if (sign.status === "LOST") return "#EF4444";
  // Yellow for DAMAGED status
  if (sign.status === "DAMAGED") return "#FBBF24";
  // Red if there are unresolved reports
  if (sign.reports.length > 0) return "#EF4444";
  // Green for deployed without issues
  return "#10B981";
};

const getStatusLabel = (sign: SignLocation): string => {
  if (sign.status === "LOST") return "LOST";
  if (sign.status === "DAMAGED") return "DAMAGED";
  if (sign.reports.length > 0) return "REPORTED ISSUE";
  return "DEPLOYED";
};

export default function SignsMapPage() {
  const [signs, setSigns] = useState<SignLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 39.8283, lng: -98.5795 }); // USA center

  useEffect(() => {
    fetchSigns();
  }, []);

  const fetchSigns = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/signs/map");
      if (res.ok) {
        const data = await res.json();
        setSigns(data.signs || []);

        // Set map center to first sign if available
        if (data.signs && data.signs.length > 0) {
          const firstSign = data.signs[0];
          if (firstSign.deployedLat && firstSign.deployedLng) {
            setMapCenter({
              lat: parseFloat(firstSign.deployedLat),
              lng: parseFloat(firstSign.deployedLng),
            });
          }
        }
      }
    } catch (err) {
      console.error("Error fetching signs:", err);
    } finally {
      setLoading(false);
    }
  };

  const getMapKey = (): string => {
    try {
      return getMapsApiKey();
    } catch (err) {
      console.error(err);
      return "";
    }
  };

  const apiKey = getMapKey();

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Sign Deployment Map</h1>
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900">Sign Deployment Map</h1>
          <p className="text-gray-600 mt-2">
            {loading ? "Loading..." : `${signs.length} deployed sign${signs.length !== 1 ? "s" : ""}`}
          </p>

          {/* Legend */}
          <div className="flex flex-wrap gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: "#10B981" }}
              ></div>
              <span className="text-gray-700">Deployed (No Issues)</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: "#FBBF24" }}
              ></div>
              <span className="text-gray-700">Damaged</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: "#EF4444" }}
              ></div>
              <span className="text-gray-700">Lost / Reported Issue</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <p className="text-gray-600">Loading map...</p>
          </div>
        ) : signs.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <p className="text-gray-600">No deployed signs with location data</p>
          </div>
        ) : (
          <APIProvider apiKey={apiKey}>
            <Map
              defaultCenter={mapCenter}
              defaultZoom={4}
              style={{ width: "100%", height: "100%" }}
              mapId="sign-deployment-map"
            >
              {signs.map((sign) => (
                <AdvancedMarker
                  key={sign.id}
                  position={{
                    lat: parseFloat(String(sign.deployedLat || 0)),
                    lng: parseFloat(String(sign.deployedLng || 0)),
                  }}
                  title={sign.signNumber || "Unknown"}
                  onClick={() => setSelectedMarker(sign.id)}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      backgroundColor: getMarkerColor(sign),
                      border: selectedMarker === sign.id ? "3px solid white" : "2px solid rgba(0,0,0,0.2)",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "white",
                      cursor: "pointer",
                      boxShadow: selectedMarker === sign.id ? "0 0 0 3px rgba(0,0,0,0.3)" : "0 2px 4px rgba(0,0,0,0.2)",
                    }}
                  >
                    {sign.signNumber || "?"}
                  </div>

                  {selectedMarker === sign.id && (
                    <InfoWindow
                      position={{
                        lat: parseFloat(String(sign.deployedLat || 0)),
                        lng: parseFloat(String(sign.deployedLng || 0)),
                      }}
                      onCloseClick={() => setSelectedMarker(null)}
                    >
                      <div className="p-4 max-w-xs">
                        <div className="mb-3">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="text-lg font-bold text-gray-900">
                                {sign.signNumber || "Unknown"}
                              </p>
                              <p className="text-sm text-gray-600">{sign.type}</p>
                            </div>
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                                getMarkerColor(sign) === "#10B981"
                                  ? "bg-green-100 text-green-800"
                                  : getMarkerColor(sign) === "#FBBF24"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {getStatusLabel(sign)}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm mb-4">
                          <div>
                            <p className="text-gray-600">Location</p>
                            <p className="text-gray-900 font-medium truncate">
                              {sign.deployedAddress || "No address"}
                            </p>
                          </div>

                          {sign.assignedToUser && (
                            <div>
                              <p className="text-gray-600">Realtor</p>
                              <p className="text-gray-900 font-medium">
                                {sign.assignedToUser.firstName} {sign.assignedToUser.lastName}
                              </p>
                            </div>
                          )}

                          {sign.assignedToOrder && (
                            <div>
                              <p className="text-gray-600">Order</p>
                              <p className="text-gray-900 font-medium">
                                #{sign.assignedToOrder.orderNumber}
                              </p>
                            </div>
                          )}

                          {sign.reports.length > 0 && (
                            <div>
                              <p className="text-red-600 font-semibold">
                                {sign.reports.length} Unresolved Report{sign.reports.length !== 1 ? "s" : ""}
                              </p>
                            </div>
                          )}
                        </div>

                        <Link
                          href={`/admin/signs/${sign.id}`}
                          className="block w-full text-center px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded"
                        >
                          View Details
                        </Link>
                      </div>
                    </InfoWindow>
                  )}
                </AdvancedMarker>
              ))}
            </Map>
          </APIProvider>
        )}
      </div>
    </div>
  );
}
