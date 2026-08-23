"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import GoogleMapReact from "google-map-react";

interface Install {
  id: string;
  scheduledFor: string | null;
  startedAt: string | null;
  completedAt: string;
  techNotes: string | null;
  issue: string | null;
  images: unknown;
  installerPayCents: number | null;
  satisfactionScore: number | null;
  order: {
    id: string;
    orderNumber: string;
    type: string;
    status: string;
    address: string;
    addressLat: number | null;
    addressLng: number | null;
    realtor: { firstName: string; lastName: string };
  };
}

interface InstallerProfile {
  installer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    createdAt: string;
    isActive: boolean;
  };
  stats: {
    completedInstalls: number;
    openJobs: number;
    totalPaidCents: number;
    paidInstallCount: number;
    averageInstallMinutes: number | null;
    timedInstallCount: number;
    satisfactionScore: number | null;
    ratedInstallCount: number;
    mappedInstalls: number;
  };
  installs: Install[];
}

function InstallMarker({
  selected,
  onClick,
}: {
  lat?: number;
  lng?: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-label="Select completed install" className="cursor-pointer">
      <span
        className="block h-5 w-5 rounded-full border-2 border-white bg-green-600 shadow-md"
        style={{ outline: selected ? "3px solid #172554" : "none" }}
      />
    </button>
  );
}

const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const formatDuration = (minutes: number | null) => {
  if (minutes === null) return "Not recorded";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

const getInstallDuration = (install: Install) => {
  if (!install.startedAt || !install.completedAt) return null;
  const duration = new Date(install.completedAt).getTime() - new Date(install.startedAt).getTime();
  return duration >= 0 ? Math.round(duration / 60000) : null;
};

export default function AdminInstallerProfilePage() {
  const params = useParams<{ id: string }>();
  const installerId = params.id;
  const [profile, setProfile] = useState<InstallerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedInstallId, setSelectedInstallId] = useState<string | null>(null);
  const mapKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/admin/field-techs/${installerId}/profile`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load installer profile");
      setProfile(data);
      setSelectedInstallId((current) => current || data.installs[0]?.id || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load installer profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [installerId]);

  const mappedInstalls = useMemo(
    () => profile?.installs.filter(
      (install) => install.order.addressLat !== null && install.order.addressLng !== null
    ) || [],
    [profile]
  );

  const mapCenter = useMemo(() => {
    if (!mappedInstalls.length) return { lat: 47.6062, lng: -122.3321 };
    return {
      lat: mappedInstalls.reduce((sum, install) => sum + Number(install.order.addressLat), 0) / mappedInstalls.length,
      lng: mappedInstalls.reduce((sum, install) => sum + Number(install.order.addressLng), 0) / mappedInstalls.length,
    };
  }, [mappedInstalls]);

  const selectedInstall = profile?.installs.find((install) => install.id === selectedInstallId) || null;

  if (loading) return <div className="p-6 text-sm text-gray-600">Loading installer profile...</div>;

  if (error || !profile) {
    return (
      <div className="space-y-4 p-6">
        <Link href="/admin/installers" className="text-sm font-medium text-primary-700 hover:underline">Back to installers</Link>
        <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error || "Installer not found"}</div>
      </div>
    );
  }

  const { installer, stats } = profile;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-7">
        <header>
          <Link href="/admin/installers" className="text-sm font-medium text-primary-700 hover:underline">Back to installers</Link>
          <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">{installer.firstName} {installer.lastName}</h1>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${installer.isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                  {installer.isActive ? "Active" : "Access removed"}
                </span>
              </div>
              <p className="mt-2 text-gray-600">{installer.email}{installer.phone ? ` · ${installer.phone}` : ""}</p>
            </div>
            <p className="text-sm text-gray-500">Installer since {new Date(installer.createdAt).toLocaleDateString()}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-px overflow-hidden border border-gray-200 bg-gray-200 md:grid-cols-5">
          <Metric label="Completed installs" value={String(stats.completedInstalls)} detail={`${stats.openJobs} open jobs`} />
          <Metric label="Total paid" value={formatMoney(stats.totalPaidCents)} detail={`${stats.paidInstallCount} of ${stats.completedInstalls} recorded`} />
          <Metric label="Average install time" value={formatDuration(stats.averageInstallMinutes)} detail={`${stats.timedInstallCount} timed installs`} />
          <Metric label="Satisfaction" value={stats.satisfactionScore === null ? "Not rated" : `${stats.satisfactionScore.toFixed(1)} / 5`} detail={`${stats.ratedInstallCount} ratings`} />
          <Metric label="Mapped posts" value={String(stats.mappedInstalls)} detail={`${stats.completedInstalls - stats.mappedInstalls} without coordinates`} />
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Completed posts map</h2>
            <span className="text-sm text-gray-500">{mappedInstalls.length} locations</span>
          </div>
          {mappedInstalls.length === 0 ? (
            <div className="border-y border-gray-200 bg-white p-6 text-sm text-gray-600">No completed installs have map coordinates.</div>
          ) : (
            <div className="grid min-h-[430px] border border-gray-200 bg-white lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="h-[430px]">
                {mapKey ? (
                  <GoogleMapReact bootstrapURLKeys={{ key: mapKey }} center={mapCenter} defaultZoom={9}>
                    {mappedInstalls.map((install) => (
                      <InstallMarker
                        key={install.id}
                        lat={Number(install.order.addressLat)}
                        lng={Number(install.order.addressLng)}
                        selected={install.id === selectedInstallId}
                        onClick={() => setSelectedInstallId(install.id)}
                      />
                    ))}
                  </GoogleMapReact>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-500">Google Maps key is not configured.</div>
                )}
              </div>
              <div className="border-t border-gray-200 p-5 lg:border-l lg:border-t-0">
                {selectedInstall ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-gray-500">{selectedInstall.order.type.replace(/_/g, " ")}</p>
                      <Link href={`/admin/orders/${selectedInstall.order.id}`} className="mt-1 block text-lg font-semibold text-primary-700 hover:underline">
                        {selectedInstall.order.orderNumber}
                      </Link>
                    </div>
                    <p className="text-sm text-gray-700">{selectedInstall.order.address}</p>
                    <p className="text-sm text-gray-600">Completed {new Date(selectedInstall.completedAt).toLocaleString()}</p>
                    <p className="text-sm text-gray-600">Client: {selectedInstall.order.realtor.firstName} {selectedInstall.order.realtor.lastName}</p>
                    <p className="text-sm text-gray-600">Install time: {formatDuration(getInstallDuration(selectedInstall))}</p>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-xl font-semibold text-gray-900">Install history</h2>
            <p className="mt-1 text-sm text-gray-600">Record installer compensation and customer satisfaction for each completed job.</p>
          </div>
          {profile.installs.length === 0 ? (
            <div className="border-y border-gray-200 bg-white p-6 text-sm text-gray-600">No completed installs yet.</div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 bg-white">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Completed</th>
                    <th className="px-4 py-3 font-semibold">Order</th>
                    <th className="px-4 py-3 font-semibold">Address</th>
                    <th className="px-4 py-3 font-semibold">Time</th>
                    <th className="px-4 py-3 font-semibold">Pay</th>
                    <th className="px-4 py-3 font-semibold">Satisfaction</th>
                    <th className="px-4 py-3 text-right font-semibold">Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {profile.installs.map((install) => (
                    <InstallHistoryRow key={install.id} install={install} installerId={installer.id} onSaved={loadProfile} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-white p-4 md:p-5">
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
    </div>
  );
}

function InstallHistoryRow({
  install,
  installerId,
  onSaved,
}: {
  install: Install;
  installerId: string;
  onSaved: () => Promise<void>;
}) {
  const [pay, setPay] = useState(install.installerPayCents === null ? "" : (install.installerPayCents / 100).toFixed(2));
  const [score, setScore] = useState(install.satisfactionScore === null ? "" : String(install.satisfactionScore));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const payNumber = pay.trim() === "" ? null : Number(pay);
    if (payNumber !== null && (!Number.isFinite(payNumber) || payNumber < 0)) {
      setError("Enter a valid pay amount");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const response = await fetch(`/api/admin/field-techs/${installerId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: install.id,
          installerPayCents: payNumber === null ? null : Math.round(payNumber * 100),
          satisfactionScore: score === "" ? null : Number(score),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save install details");
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save install details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="align-top">
      <td className="whitespace-nowrap px-4 py-4 text-gray-600">{new Date(install.completedAt).toLocaleDateString()}</td>
      <td className="px-4 py-4">
        <Link href={`/admin/orders/${install.order.id}`} className="font-semibold text-primary-700 hover:underline">{install.order.orderNumber}</Link>
        <p className="mt-1 text-xs text-gray-500">{install.order.type.replace(/_/g, " ")}</p>
      </td>
      <td className="max-w-[260px] px-4 py-4 text-gray-700">
        <p>{install.order.address}</p>
        <p className="mt-1 text-xs text-gray-500">{install.order.realtor.firstName} {install.order.realtor.lastName}</p>
        {install.techNotes ? <p className="mt-2 text-xs text-gray-500">{install.techNotes}</p> : null}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-gray-700">{formatDuration(getInstallDuration(install))}</td>
      <td className="px-4 py-4">
        <div className="flex h-9 w-28 items-center rounded-md border border-gray-300 bg-white px-2">
          <span className="text-gray-500">$</span>
          <input value={pay} onChange={(event) => setPay(event.target.value)} inputMode="decimal" aria-label={`Pay for ${install.order.orderNumber}`} className="min-w-0 flex-1 border-0 px-1 text-right text-gray-900 outline-none" />
        </div>
      </td>
      <td className="px-4 py-4">
        <select value={score} onChange={(event) => setScore(event.target.value)} aria-label={`Satisfaction for ${install.order.orderNumber}`} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-gray-900">
          <option value="">Not rated</option>
          {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
        </select>
      </td>
      <td className="px-4 py-4 text-right">
        <button type="button" onClick={() => void save()} disabled={saving} className="h-9 rounded-md bg-primary-600 px-3 font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
          {saving ? "Saving..." : "Save"}
        </button>
        {error ? <p className="mt-2 max-w-[180px] text-xs text-red-700">{error}</p> : null}
      </td>
    </tr>
  );
}