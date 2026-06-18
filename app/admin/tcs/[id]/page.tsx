"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import GoogleMapReact from "google-map-react";

interface LinkedAgent {
  linkId: string;
  grantedBy: string;
  linkedAt: string;
  agent: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
  };
}

interface TCOrder {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  address: string;
  addressLat: number | null;
  addressLng: number | null;
  createdAt: string;
  scheduledDate: string | null;
  realtor: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface TCProfileData {
  tc: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    isActive: boolean;
    createdAt: string;
  };
  linkedAgents: LinkedAgent[];
  orders: TCOrder[];
  stats: {
    linkedAgentCount: number;
    totalOrders: number;
    mappedOrders: number;
  };
}

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

const getMarkerColor = (status: string): string => {
  switch (status) {
    case "COMPLETED":
      return "#10B981";
    case "SCHEDULED":
      return "#3B82F6";
    case "IN_PROGRESS":
      return "#A855F7";
    case "IN_GROUND":
      return "#06B6D4";
    case "ON_HOLD":
      return "#F97316";
    case "CANCELLED":
      return "#EF4444";
    case "PENDING":
    default:
      return "#FBBF24";
  }
};

const OrderMarker = (props: {
  order: TCOrder;
  selected: boolean;
  onClick: () => void;
  [key: string]: any;
}) => {
  const { order, selected, onClick } = props;

  return (
    <div
      onClick={onClick}
      className="cursor-pointer transition-transform hover:scale-110"
      title={`${order.orderNumber} - ${order.address}`}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          backgroundColor: getMarkerColor(order.status),
          border: selected ? "3px solid white" : "2px solid rgba(0,0,0,0.25)",
          boxShadow: selected
            ? "0 0 0 3px rgba(0,0,0,0.35)"
            : "0 2px 4px rgba(0,0,0,0.25)",
        }}
      />
    </div>
  );
};

export default function AdminTCProfilePage() {
  const params = useParams();
  const tcId = params.id as string;

  const [profile, setProfile] = useState<TCProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 47.6, lng: -122.3 });
  const [mapKey, setMapKey] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileForm, setProfileForm] = useState({
    email: "",
    phone: "",
  });

  const mappedOrders = useMemo(
    () =>
      (profile?.orders || []).filter(
        (order) => order.addressLat !== null && order.addressLng !== null
      ),
    [profile]
  );

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (key) {
      setMapKey(key);
    }
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/admin/tcs/${tcId}/profile`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to load TC profile");
          return;
        }

        setProfile(data);
        setProfileForm({
          email: data?.tc?.email || "",
          phone: data?.tc?.phone || "",
        });

        const firstMapped = (data.orders || []).find(
          (o: TCOrder) => o.addressLat !== null && o.addressLng !== null
        );
        if (firstMapped) {
          setMapCenter({
            lat: Number(firstMapped.addressLat),
            lng: Number(firstMapped.addressLng),
          });
        }
      } catch (_err) {
        setError("Failed to load TC profile");
      } finally {
        setLoading(false);
      }
    };

    if (tcId) {
      fetchProfile();
    }
  }, [tcId]);

  const handleUnlink = async (linkId: string) => {
    const confirmed = confirm("Remove this linked agent from this TC account?");
    if (!confirmed || !profile) return;

    try {
      setUnlinkingId(linkId);
      setError("");

      const res = await fetch(`/api/admin/tcs/link/${linkId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to unlink agent");
        return;
      }

      const updatedAgents = profile.linkedAgents.filter(
        (agent) => agent.linkId !== linkId
      );
      setProfile({
        ...profile,
        linkedAgents: updatedAgents,
        stats: {
          ...profile.stats,
          linkedAgentCount: updatedAgents.length,
        },
      });
    } catch (_err) {
      setError("Failed to unlink agent");
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    try {
      setProfileSubmitting(true);
      setError("");

      const res = await fetch(`/api/admin/tcs/${profile.tc.id}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: profileForm.email.trim(),
          phone: profileForm.phone.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update TC profile");
        return;
      }

      setProfile({
        ...profile,
        tc: {
          ...profile.tc,
          email: data.tc.email,
          phone: data.tc.phone,
        },
      });
      setIsEditingProfile(false);
    } catch (_err) {
      setError("Failed to update TC profile");
    } finally {
      setProfileSubmitting(false);
    }
  };

  const selectedOrder =
    selectedOrderId && profile
      ? profile.orders.find((o) => o.id === selectedOrderId) || null
      : null;

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Link href="/admin/tcs" className="text-indigo-600 hover:text-indigo-800">
            ← Back to TC Accounts
          </Link>
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            {error || "TC profile not found"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <Link href="/admin/tcs" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
            ← Back to TC Accounts
          </Link>
          <div className="mt-3 bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {profile.tc.firstName} {profile.tc.lastName}
                </h1>
                {!isEditingProfile ? (
                  <>
                    <p className="text-gray-600 mt-1">{profile.tc.email}</p>
                    <p className="text-gray-600">{profile.tc.phone || "No phone"}</p>
                  </>
                ) : (
                  <div className="mt-2 space-y-2 max-w-sm">
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Email"
                    />
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Phone"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-start gap-2">
                {!isEditingProfile ? (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileForm({
                        email: profile.tc.email || "",
                        phone: profile.tc.phone || "",
                      });
                      setIsEditingProfile(true);
                    }}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Edit Contact
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={profileSubmitting}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-400"
                    >
                      {profileSubmitting ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingProfile(false);
                        setProfileForm({
                          email: profile.tc.email || "",
                          phone: profile.tc.phone || "",
                        });
                      }}
                      disabled={profileSubmitting}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </>
                )}
                <span
                  className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                    profile.tc.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {profile.tc.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-600">Linked Agents</p>
                <p className="text-2xl font-bold text-gray-900">
                  {profile.stats.linkedAgentCount}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-600">Orders Placed By TC</p>
                <p className="text-2xl font-bold text-gray-900">
                  {profile.stats.totalOrders}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-600">Orders On Map</p>
                <p className="text-2xl font-bold text-gray-900">
                  {profile.stats.mappedOrders}
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Linked Agents</h2>
          {profile.linkedAgents.length === 0 ? (
            <p className="text-sm text-gray-600">No linked agents.</p>
          ) : (
            <div className="space-y-3">
              {profile.linkedAgents.map((linked) => (
                <div
                  key={linked.linkId}
                  className="flex items-center justify-between gap-4 p-3 border border-gray-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {linked.agent.firstName} {linked.agent.lastName}
                    </p>
                    <p className="text-sm text-gray-600">{linked.agent.email}</p>
                  </div>
                  <button
                    onClick={() => handleUnlink(linked.linkId)}
                    disabled={unlinkingId === linked.linkId}
                    className="px-3 py-1 text-sm font-medium text-red-600 hover:text-red-800 disabled:text-gray-400"
                  >
                    {unlinkingId === linked.linkId ? "Removing..." : "Remove Agent"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Orders</h2>
            {profile.orders.length === 0 ? (
              <p className="text-sm text-gray-600">No orders found for this TC.</p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {profile.orders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedOrderId === order.id
                        ? "border-indigo-300 bg-indigo-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-gray-900">{order.orderNumber}</p>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {order.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{order.address}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Agent: {order.realtor.firstName} {order.realtor.lastName}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="xl:col-span-3 bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3 px-2">
              <h2 className="text-xl font-semibold text-gray-900">Orders Map</h2>
              <span className="text-sm text-gray-600">{mappedOrders.length} mapped</span>
            </div>

            {!mapKey ? (
              <div className="h-[560px] rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
                NEXT_PUBLIC_GOOGLE_MAPS_KEY is not configured.
              </div>
            ) : mappedOrders.length === 0 ? (
              <div className="h-[560px] rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-600">
                No orders with map coordinates.
              </div>
            ) : (
              <div className="h-[560px] rounded-lg overflow-hidden border border-gray-200 relative">
                <GoogleMapReact
                  bootstrapURLKeys={{ key: mapKey }}
                  defaultCenter={mapCenter}
                  defaultZoom={9}
                >
                  {mappedOrders.map((order) => (
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
                      Agent: {selectedOrder.realtor.firstName} {selectedOrder.realtor.lastName}
                    </p>
                    <div className="mt-3">
                      <Link
                        href={`/admin/orders/${selectedOrder.id}`}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        View Order Details →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
