"use client";

import { useEffect, useState } from "react";

type Subscription = {
  status: "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED" | "BUYOUT";
  tier: string;
  trialEndsAt: string;
  savedPaymentMethodId: string | null;
  monthlyPriceCents: number;
  billingFailureReason: string | null;
};

type DashboardData = {
  subscription: Subscription | null;
  tags: Array<{ id: string; tagCode: string; signNumber: string | null; status: string; listingAddress: string; tapCount: number; lastTapAt: string | null; url: string }>;
  summary: { totalTaps: number; tapsThisWeek: number; trend: number };
  dailyTaps: Array<{ date: string; taps: number }>;
};

type Card = { id: string; last4: string | null; nickname: string | null };

export default function SmartSignDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const [dashboardRes, cardsRes] = await Promise.all([
        fetch("/api/smart-sign/dashboard"),
        fetch("/api/payments/card-on-file"),
      ]);
      const dashboard = await dashboardRes.json();
      const cardData = cardsRes.ok ? await cardsRes.json() : { cards: [] };
      if (!dashboardRes.ok) throw new Error(dashboard.error || "Unable to load Smart Sign");
      setData(dashboard);
      setCards(cardData.cards || []);
      setSelectedCardId((current) => dashboard.subscription?.savedPaymentMethodId || current || cardData.cards?.[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Smart Sign");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const updateSubscription = async (action: "SAVE_CARD" | "SUBSCRIBE" | "BUYOUT" | "CANCEL") => {
    if ((action === "SAVE_CARD" || action === "SUBSCRIBE" || action === "BUYOUT") && !selectedCardId) {
      setError("Add or select a saved card first.");
      return;
    }
    if (action === "CANCEL" && !window.confirm("Stop live Smart Sign routing now? You can reactivate later.")) return;

    try {
      setSaving(true);
      setError("");
      const response = await fetch("/api/smart-sign/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, savedPaymentMethodId: selectedCardId || undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update subscription");
      await load();
    } catch (subscriptionError) {
      setError(subscriptionError instanceof Error ? subscriptionError.message : "Unable to update subscription");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-600">Loading Smart Sign analytics...</div>;
  if (!data) return <div className="p-8 text-red-700">{error || "Smart Sign is unavailable"}</div>;

  const subscription = data.subscription;
  const trialDaysRemaining = subscription?.status === "TRIAL"
    ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;
  const maxDailyTaps = Math.max(1, ...data.dailyTaps.map((day) => day.taps));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Smart Sign</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Listing engagement</h1>
        <p className="mt-2 text-slate-600">See anonymous QR and NFC engagement across your active tagged posts.</p>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Total taps</p>
          <p className="mt-2 text-4xl font-semibold text-slate-900">{data.summary.totalTaps}</p>
        </div>
        <div className="border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">This week</p>
          <p className="mt-2 text-4xl font-semibold text-slate-900">{data.summary.tapsThisWeek}</p>
          <p className={`mt-1 text-sm font-medium ${data.summary.trend >= 0 ? "text-emerald-700" : "text-red-700"}`}>{data.summary.trend >= 0 ? "+" : ""}{data.summary.trend}% vs. prior week</p>
        </div>
        <div className="border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Tagged posts</p>
          <p className="mt-2 text-4xl font-semibold text-slate-900">{data.tags.length}</p>
        </div>
      </section>

      <section className="border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Subscription</h2>
            {!subscription ? <p className="mt-1 text-sm text-slate-600">Your trial begins automatically when a tagged post is assigned to you.</p> : (
              <p className="mt-1 text-sm text-slate-600">
                {subscription.status === "TRIAL" && `${trialDaysRemaining} day${trialDaysRemaining === 1 ? "" : "s"} left in your free trial.`}
                {subscription.status === "ACTIVE" && `Active at $${(subscription.monthlyPriceCents / 100).toFixed(2)}/month.`}
                {subscription.status === "BUYOUT" && "One-time buyout active. Smart Sign remains live."}
                {subscription.status === "EXPIRED" && "Your trial ended. Add a card to reactivate live listing routing."}
                {subscription.status === "CANCELLED" && "Cancelled. Add a card to reactivate live listing routing."}
              </p>
            )}
          </div>
          {subscription && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{subscription.status.replace("_", " ")}</span>}
        </div>

        {subscription && subscription.status !== "BUYOUT" && subscription.status !== "CANCELLED" && (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-medium text-slate-700">Saved payment method
              <select value={selectedCardId} onChange={(event) => setSelectedCardId(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900">
                <option value="">Select a saved card</option>
                {cards.map((card) => <option key={card.id} value={card.id}>{card.nickname || "Card"} ending in {card.last4 || "saved"}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void updateSubscription("SAVE_CARD")} disabled={saving || !selectedCardId} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Save card</button>
            <button type="button" onClick={() => void updateSubscription("SUBSCRIBE")} disabled={saving || !selectedCardId} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">Continue at $29/mo</button>
            <button type="button" onClick={() => void updateSubscription("BUYOUT")} disabled={saving || !selectedCardId} className="rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50">Buy out $99</button>
          </div>
        )}
        {subscription?.status === "ACTIVE" && <button type="button" onClick={() => void updateSubscription("CANCEL")} disabled={saving} className="mt-4 text-sm font-medium text-red-700 hover:text-red-900">Cancel Smart Sign</button>}
        {subscription?.billingFailureReason && <p className="mt-3 text-sm text-red-700">Billing issue: {subscription.billingFailureReason}</p>}
      </section>

      <section className="border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Last 7 days</h2>
        <div className="mt-5 flex h-40 items-end gap-2">
          {data.dailyTaps.map((day) => <div key={day.date} className="flex flex-1 flex-col items-center gap-2"><span className="text-xs font-medium text-slate-700">{day.taps}</span><div className="w-full bg-sky-600" style={{ height: `${Math.max(4, (day.taps / maxDailyTaps) * 110)}px` }} /><span className="text-[10px] text-slate-500">{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</span></div>)}
        </div>
      </section>

      <section className="border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Posts and listings</h2>
        {data.tags.length === 0 ? <p className="mt-3 text-sm text-slate-600">No Smart Sign tags are assigned to your active posts yet.</p> : <div className="mt-4 divide-y divide-slate-100">{data.tags.map((tag) => <div key={tag.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-slate-900">{tag.listingAddress}</p><p className="text-sm text-slate-500">Post {tag.signNumber || "unlabeled"} · {tag.tapCount} taps {tag.lastTapAt ? `· last tap ${new Date(tag.lastTapAt).toLocaleDateString()}` : ""}</p></div><a href={tag.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-sky-700 hover:text-sky-900">Open public page</a></div>)}</div>}
      </section>
    </div>
  );
}
