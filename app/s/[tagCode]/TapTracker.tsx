"use client";

import { useEffect, useState } from "react";
import { TAPBOX_TEST_MODE_COOKIE, trackTapboxVisit } from "@/lib/tapbox-tracking";

export function TapTracker({ tagCode, signId }: { tagCode?: string; signId?: string }) {
  const [locationStatus, setLocationStatus] = useState<"idle" | "sharing" | "shared" | "unavailable">("idle");
  const [testMode, setTestMode] = useState(false);
  const [visitSource, setVisitSource] = useState<"box" | "share">("box");
  const endpoint = tagCode ? `/api/smart-sign/${encodeURIComponent(tagCode)}/tap` : signId ? `/api/tap/${encodeURIComponent(signId)}/tap` : null;

  useEffect(() => {
    if (!endpoint) return;

    const params = new URLSearchParams(window.location.search);
    const testPreference = params.get("tapbox-test");
    const source = params.get("source") === "share" || params.get("source") === "activation-email" ? "share" : "box";
    setVisitSource(source);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    if (testPreference === "1") {
      document.cookie = `${TAPBOX_TEST_MODE_COOKIE}=1; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
    } else if (testPreference === "0") {
      document.cookie = `${TAPBOX_TEST_MODE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
    }

    const isTestMode = document.cookie.split(";").some((cookie) => cookie.trim() === `${TAPBOX_TEST_MODE_COOKIE}=1`);
    setTestMode(isTestMode);
    if (isTestMode) return;

    return trackTapboxVisit(endpoint, {
      source,
      onBoxVisitRecorded: () => {
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.get("source") === "share") return;
        currentUrl.searchParams.set("source", "share");
        window.history.replaceState(window.history.state, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
        setVisitSource("share");
      },
    });
  }, [endpoint]);

  const shareLocation = () => {
    if (testMode) {
      setLocationStatus("unavailable");
      return;
    }
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
            source: visitSource,
            deviceType: /Android/i.test(navigator.userAgent) ? "Android" : /iPhone|iPad/i.test(navigator.userAgent) ? "iOS" : "Web",
          }),
        });
        setLocationStatus("shared");
      },
      () => setLocationStatus("unavailable"),
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 }
    );
  };

  const resumeTracking = () => {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${TAPBOX_TEST_MODE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
    const url = new URL(window.location.href);
    url.searchParams.delete("tapbox-test");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setTestMode(false);
  };

  if (locationStatus === "shared") return <p className="mt-5 text-xs text-slate-500">Approximate location shared.</p>;
  if (locationStatus === "unavailable") return <p className="mt-5 text-xs text-slate-500">{testMode ? "Location sharing is off in test mode." : "Location was not shared."}</p>;

  return (
    <>
      {testMode ? (
        <p role="status" className="mt-5 text-xs text-slate-500">
          Test mode is on for this browser. Visits are excluded.{" "}
          <button type="button" onClick={resumeTracking} className="underline underline-offset-4 hover:text-slate-700">Resume tracking</button>
        </p>
      ) : (
        <button
          type="button"
          onClick={shareLocation}
          disabled={locationStatus === "sharing"}
          className="mt-5 text-xs font-medium text-slate-500 underline underline-offset-4 hover:text-slate-700 disabled:opacity-50"
        >
          {locationStatus === "sharing" ? "Sharing approximate location..." : "Share approximate location with this listing"}
        </button>
      )}
    </>
  );
}
