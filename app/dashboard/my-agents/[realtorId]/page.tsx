"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import GoogleMapReact from "google-map-react";

interface RealtorProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  brokerageName?: string | null;
}

interface MapPost {
  id: string;
  orderNumber: string;
  address: string;
  addressLat: number;
  addressLng: number;
  type: string;
  status: string;
  scheduledDate: string | null;
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  amount: number | null;
  discountAmount: number | null;
  paidAmount: number | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
}

interface ProfileResponse {
  realtor: RealtorProfile;
  mapPosts: MapPost[];
  pendingInvoices: Invoice[];
  pastInvoices: Invoice[];
  totals: {
    totalOrders: number;
    mappedPosts: number;
    pendingInvoices: number;
    pastInvoices: number;
  };
}

const markerColorByStatus: Record<string, string> = {
  PENDING: "#f59e0b",
  SCHEDULED: "#3b82f6",
  ON_HOLD: "#f97316",
  IN_PROGRESS: "#8b5cf6",
  IN_GROUND: "#10b981",
  COMPLETED: "#059669",
  CANCELLED: "#ef4444",
};

function MapMarker({
  color,
  active,
  onClick,
}: {
  color: string;
  active: boolean;
  onClick: () => void;
  lat?: number;
  lng?: number;
}) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer" aria-label="Map post marker">
      <span
        style={{
          display: "block",
          width: 16,
          height: 16,
          borderRadius: "50%",
          backgroundColor: color,
          border: active ? "3px solid #111827" : "2px solid rgba(255,255,255,0.95)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
}

export default function TCAgentProfilePage() {
  const params = useParams<{ realtorId: string }>();
  const realtorId = params?.realtorId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [mapKey, setMapKey] = useState("");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (key) {
      setMapKey(key);
    }
  }, []);

  useEffect(() => {
    async function fetchProfile() {
      if (!realtorId) {
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await fetch(`/api/tc/realtors/${realtorId}/profile`, {
          method: "GET",
          credentials: "include",
        });

        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load realtor profile");
        }

        setProfile(data);
        const firstPost = Array.isArray(data?.mapPosts) && data.mapPosts.length > 0 ? data.mapPosts[0] : null;
        setSelectedPostId(firstPost?.id || null);
      } catch (err: any) {
        setError(err?.message || "Failed to load realtor profile");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [realtorId]);

  const selectedPost = useMemo(() => {
    if (!profile?.mapPosts?.length) return null;
    return profile.mapPosts.find((post) => post.id === selectedPostId) || profile.mapPosts[0];
  }, [profile, selectedPostId]);

  const mapCenter = useMemo(() => {
    if (selectedPost) {
      return { lat: selectedPost.addressLat, lng: selectedPost.addressLng };
    }

    if (profile?.mapPosts?.length) {
      return {
        lat: profile.mapPosts[0].addressLat,
        lng: profile.mapPosts[0].addressLng,
      };
    }

    return { lat: 47.6062, lng: -122.3321 };
  }, [profile, selectedPost]);

  const formatMoney = (amount: number | null | undefined) => `$${(Number(amount || 0) * 100 / 100).toFixed(2)}`;
  const formatDate = (dateValue: string | null) => (dateValue ? new Date(dateValue).toLocaleDateString() : "-");

  if (loading) {
    return <div className="text-sm text-slate-600">Loading profile...</div>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/my-agents" className="text-sm font-medium text-navy-800 hover:underline">
          ← Back to My Agents
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/my-agents" className="text-sm font-medium text-navy-800 hover:underline">
          ← Back to My Agents
        </Link>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Profile not found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/my-agents" className="text-sm font-medium text-navy-800 hover:underline">
            ← Back to My Agents
          </Link>
          <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 mt-2">
            {profile.realtor.firstName} {profile.realtor.lastName}
          </h1>
          <p className="text-slate-600 mt-1">{profile.realtor.email}{profile.realtor.brokerageName ? ` • ${profile.realtor.brokerageName}` : ""}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/orders/new?realtorId=${profile.realtor.id}&type=INSTALL`}
            className="inline-flex h-10 items-center rounded-lg bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700"
          >
            Place Install
          </Link>
          <Link
            href={`/dashboard/orders/new?realtorId=${profile.realtor.id}&type=REMOVAL`}
            className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Place Removal
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Orders</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{profile.totals.totalOrders}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Mapped Posts</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{profile.totals.mappedPosts}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs uppercase tracking-wide text-amber-700">Pending Invoices</p>
          <p className="text-2xl font-semibold text-amber-900 mt-1">{profile.totals.pendingInvoices}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs uppercase tracking-wide text-emerald-700">Past Invoices</p>
          <p className="text-2xl font-semibold text-emerald-900 mt-1">{profile.totals.pastInvoices}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
        <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900">Posts Map</h2>
        {profile.mapPosts.length === 0 ? (
          <p className="text-sm text-slate-600 mt-3">No mapped posts available yet for this realtor.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 overflow-hidden rounded-lg border border-slate-200" style={{ height: 360 }}>
              {mapKey ? (
                <GoogleMapReact bootstrapURLKeys={{ key: mapKey }} defaultZoom={11} center={mapCenter}>
                  {profile.mapPosts.map((post) => (
                    <MapMarker
                      key={post.id}
                      lat={post.addressLat}
                      lng={post.addressLng}
                      color={markerColorByStatus[post.status] || "#64748b"}
                      active={post.id === selectedPost?.id}
                      onClick={() => setSelectedPostId(post.id)}
                    />
                  ))}
                </GoogleMapReact>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-slate-500">Map key missing</div>
              )}
            </div>
            <div className="lg:col-span-2 rounded-lg border border-slate-200">
              <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
                {profile.mapPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setSelectedPostId(post.id)}
                    className={`w-full p-3 text-left hover:bg-slate-50 ${post.id === selectedPost?.id ? "bg-navy-50" : ""}`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{post.orderNumber}</p>
                    <p className="text-xs text-slate-600 mt-1">{post.address}</p>
                    <p className="text-xs text-slate-500 mt-1">{post.type} • {post.status.replace(/_/g, " ")}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl border border-amber-200 bg-white overflow-hidden">
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
            <h3 className="font-semibold text-amber-900">Pending Invoices</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {profile.pendingInvoices.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No pending invoices.</p>
            ) : (
              profile.pendingInvoices.map((invoice) => (
                <div key={invoice.id} className="p-4">
                  <p className="text-sm font-semibold text-slate-900">{invoice.invoiceNumber || `Draft ${invoice.id.slice(0, 8)}`}</p>
                  <p className="text-xs text-slate-600 mt-1">Due: {formatDate(invoice.dueDate)} • {invoice.status}</p>
                  <p className="text-sm text-amber-800 mt-1">Amount: {formatMoney(invoice.amount)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-white overflow-hidden">
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-3">
            <h3 className="font-semibold text-emerald-900">Past Invoices</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {profile.pastInvoices.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No past invoices yet.</p>
            ) : (
              profile.pastInvoices.map((invoice) => (
                <div key={invoice.id} className="p-4">
                  <p className="text-sm font-semibold text-slate-900">{invoice.invoiceNumber || `Invoice ${invoice.id.slice(0, 8)}`}</p>
                  <p className="text-xs text-slate-600 mt-1">Created: {formatDate(invoice.createdAt)} • {invoice.status}</p>
                  <p className="text-sm text-emerald-800 mt-1">Amount: {formatMoney(invoice.amount)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
