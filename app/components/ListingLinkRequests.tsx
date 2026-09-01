"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "./EmptyState";

type Order = {
  id: string;
  orderNumber: string;
  address: string;
  status: string;
  rfidListingUrl: string | null;
  realtor: { firstName: string; lastName: string; brokerageName: string | null };
};

type LinkRequest = {
  id: string;
  orderId: string;
  requestedUrl: string;
  status: string;
  reviewNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export function ListingLinkRequests() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [requests, setRequests] = useState<LinkRequest[]>([]);
  const [orderId, setOrderId] = useState("");
  const [requestedUrl, setRequestedUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function load() {
    try {
      const response = await fetch("/api/listing-link-requests");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load listing links");
      setOrders(data.orders || []);
      setRequests(data.requests || []);
      setOrderId((current) => current || data.orders?.[0]?.id || "");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to load listing links" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function submit() {
    try {
      setSaving(true);
      setMessage(null);
      const response = await fetch("/api/listing-link-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, requestedUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit link");
      setRequestedUrl("");
      setMessage({ type: "success", text: "Link submitted for admin review." });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to submit link" });
    } finally {
      setSaving(false);
    }
  }

  const latestByOrder = new Map<string, LinkRequest>();
  requests.forEach((request) => {
    if (!latestByOrder.has(request.orderId)) latestByOrder.set(request.orderId, request);
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Listing websites</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Listing links</h1>
        <p className="mt-2 text-slate-600">Submit the public property website for a listing. An administrator reviews every link before it appears on the Smart Sign page.</p>
      </div>

      {message && <div role="status" className={`rounded-lg border p-4 text-sm ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>{message.text}</div>}

      <section className="border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Request a link</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="text-sm font-medium text-slate-700">Listing
            <select value={orderId} onChange={(event) => setOrderId(event.target.value)} disabled={loading} className="mt-1 block h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900">
              <option value="">Select a listing</option>
              {orders.map((order) => <option key={order.id} value={order.id}>{order.address} · {order.orderNumber} · {order.realtor.firstName} {order.realtor.lastName}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">Public listing website
            <input type="url" inputMode="url" value={requestedUrl} onChange={(event) => setRequestedUrl(event.target.value)} placeholder="https://listing.example.com" className="mt-1 block h-12 w-full rounded-lg border border-slate-300 px-3 text-base text-slate-900" />
          </label>
          <button type="button" onClick={() => void submit()} disabled={saving || !orderId || !requestedUrl.trim()} className="h-12 rounded-lg bg-navy-900 px-5 font-semibold text-white hover:bg-navy-700 disabled:opacity-50">{saving ? "Submitting..." : "Submit for review"}</button>
        </div>
        {!loading && orders.length === 0 && <div className="mt-4"><EmptyState title="No active listings" description="No active listings are available to this account." /></div>}
      </section>

      <section className="border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Listings and review status</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {orders.map((order) => {
            const request = latestByOrder.get(order.id);
            return (
              <div key={order.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="font-semibold text-slate-900">{order.address}</p>
                    <p className="text-sm text-slate-500">{order.orderNumber} · {order.realtor.firstName} {order.realtor.lastName}</p>
                    {order.rfidListingUrl && <a href={order.rfidListingUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block break-all text-sm font-medium text-sky-700 hover:underline">{order.rfidListingUrl}</a>}
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${request?.status === "PENDING" ? "bg-amber-100 text-amber-900" : request?.status === "REJECTED" ? "bg-red-100 text-red-800" : order.rfidListingUrl ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                    {request?.status === "PENDING" ? "Awaiting review" : request?.status === "REJECTED" ? "Rejected" : order.rfidListingUrl ? "Approved" : "No link"}
                  </span>
                </div>
                {request?.status === "REJECTED" && request.reviewNotes && <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-800"><strong>Admin note:</strong> {request.reviewNotes}</p>}
                {request?.status === "PENDING" && <p className="mt-2 break-all text-sm text-slate-600">Submitted: {request.requestedUrl}</p>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}