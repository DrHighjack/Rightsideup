"use client";

import { useEffect, useState } from "react";

export function TapTracker({ tagCode, signId }: { tagCode?: string; signId?: string }) {
  const [locationStatus, setLocationStatus] = useState<"idle" | "sharing" | "shared" | "unavailable">("idle");
  const endpoint = tagCode ? `/api/smart-sign/${encodeURIComponent(tagCode)}/tap` : signId ? `/api/tap/${encodeURIComponent(signId)}/tap` : null;

  useEffect(() => {
    if (!endpoint) return;
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceType: /Android/i.test(navigator.userAgent) ? "Android" : /iPhone|iPad/i.test(navigator.userAgent) ? "iOS" : "Web" }),
    });
  }, [endpoint]);

  const shareLocation = () => {
    if (!navigator.geolocation || !endpoint) {
      setLocationStatus("unavailable");
      return;
    }
    setLocationStatus("sharing");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: Number(position.coords.latitude.toFixed(3)),
            longitude: Number(position.coords.longitude.toFixed(3)),
            deviceType: /Android/i.test(navigator.userAgent) ? "Android" : /iPhone|iPad/i.test(navigator.userAgent) ? "iOS" : "Web",
          }),
        });
        setLocationStatus("shared");
      },
      () => setLocationStatus("unavailable"),
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 }
    );
  };

  if (locationStatus === "shared") return <p className="mt-5 text-xs text-slate-500">Approximate location shared.</p>;
  if (locationStatus === "unavailable") return <p className="mt-5 text-xs text-slate-500">Location was not shared.</p>;

  return (
    <button
      type="button"
      onClick={shareLocation}
      disabled={locationStatus === "sharing"}
      className="mt-5 text-xs font-medium text-slate-500 underline underline-offset-4 hover:text-slate-700 disabled:opacity-50"
    >
      {locationStatus === "sharing" ? "Sharing approximate location..." : "Share approximate location with this listing"}
    </button>
  );
}
