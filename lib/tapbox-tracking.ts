type TapboxVisitResponse = { recorded?: boolean; isLive?: boolean; visitToken?: string };

const pendingVisits = new Map<string, Promise<TapboxVisitResponse>>();
export const TAPBOX_TEST_MODE_COOKIE = "tapbox-test-mode";

export function trackTapboxVisit(endpoint: string, options: { source?: "box" | "share"; onBoxVisitRecorded?: () => void } = {}) {
  if (typeof document !== "undefined" && document.cookie.split(";").some((cookie) => cookie.trim() === `${TAPBOX_TEST_MODE_COOKIE}=1`)) {
    return () => {};
  }

  let stopped = false;
  let token: string | undefined;
  let elapsed = 0;
  let visibleSince: number | null = document.visibilityState === "hidden" ? null : performance.now();
  let lastReported = -1;

  const activeTime = () => Math.floor(elapsed + (visibleSince === null ? 0 : Math.max(0, performance.now() - visibleSince)));
  const pause = () => {
    elapsed = activeTime();
    visibleSince = null;
  };
  const report = (beacon = false) => {
    if (!token) return;
    const activeMilliseconds = activeTime();
    if (activeMilliseconds === lastReported) return;
    const body = JSON.stringify({ visitToken: token, activeMilliseconds });
    if (beacon && typeof navigator.sendBeacon === "function") {
      try {
        if (navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }))) {
          lastReported = activeMilliseconds;
          return;
        }
      } catch {}
    }
    lastReported = activeMilliseconds;
    void fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true,
    }).then((response) => {
      if (!response.ok && lastReported === activeMilliseconds) lastReported = -1;
    }).catch(() => {
      if (lastReported === activeMilliseconds) lastReported = -1;
    });
  };
  const visibilityChanged = () => {
    if (document.visibilityState === "hidden") {
      pause();
      report(true);
    } else if (visibleSince === null) {
      visibleSince = performance.now();
    }
  };
  const pageHidden = () => { pause(); report(true); };
  const pageShown = () => {
    if (document.visibilityState !== "hidden" && visibleSince === null) visibleSince = performance.now();
  };

  const source = options.source || "box";
  const pendingKey = `${endpoint}:${source}`;
  let pending = pendingVisits.get(pendingKey);
  if (!pending) {
    const isReload = performance.getEntriesByType("navigation").some((entry) => (entry as PerformanceNavigationTiming).type === "reload");
    pending = fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
      body: JSON.stringify({
        deviceType: /Android/i.test(navigator.userAgent) ? "Android" : /iPhone|iPad/i.test(navigator.userAgent) ? "iOS" : "Web",
        isReload,
        source,
      }),
    }).then(async (response) => response.ok ? await response.json() as TapboxVisitResponse : {})
      .catch(() => ({})).finally(() => pendingVisits.delete(pendingKey));
    pendingVisits.set(pendingKey, pending);
  }
  void pending.then((visit) => {
    if (source === "box" && visit.recorded && visit.isLive) options.onBoxVisitRecorded?.();
    if (stopped || typeof visit.visitToken !== "string") return;
    token = visit.visitToken;
    if (document.visibilityState === "hidden") report(true);
  });

  const interval = window.setInterval(() => {
    if (document.visibilityState !== "hidden") report();
  }, 30000);
  document.addEventListener("visibilitychange", visibilityChanged);
  window.addEventListener("pagehide", pageHidden);
  window.addEventListener("pageshow", pageShown);

  return () => {
    if (stopped) return;
    pause();
    report(true);
    stopped = true;
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", visibilityChanged);
    window.removeEventListener("pagehide", pageHidden);
    window.removeEventListener("pageshow", pageShown);
  };
}