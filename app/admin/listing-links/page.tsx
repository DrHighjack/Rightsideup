"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/app/components/EmptyState";

type ReviewRequest = {
  id: string;
  requestedUrl: string;
  requesterRole: string;
  status: string;
  reviewNotes: string | null;
  createdAt: string;
  order: { orderNumber: string; address: string; rfidListingUrl: string | null; realtor: { firstName: string; lastName: string; brokerageName: string | null } } | null;
  requestedBy: { firstName: string; lastName: string; email: string } | null;
};

export default function AdminListingLinksPage() {
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [status, setStatus] = useState("PENDING");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function load(nextStatus = status) {
    try {
      const response = await fetch(`/api/admin/listing-link-requests?status=${encodeURIComponent(nextStatus)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load requests");
      setRequests(data.requests || []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load requests");
    }
  }

  useEffect(() => { void load(); }, [status]);

  async function review(id: string, decision: "APPROVED" | "REJECTED") {
    try {
      setBusyId(id);
      setError("");
      const response = await fetch("/api/admin/listing-link-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision, reviewNotes: notes[id] || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to review request");
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to review request");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Content moderation</p><h1 className="mt-1 text-3xl font-semibold text-slate-900">Listing link approvals</h1><p className="mt-2 text-slate-600">Open each website and verify it belongs to the listing before approval.</p></div>
        <label className="text-sm font-medium text-slate-700">Status
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="ml-2 h-10 rounded-md border border-slate-300 bg-white px-3"><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="ALL">All</option></select>
        </label>
      </div>
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
      <div className="space-y-4">
        {requests.map((request) => (
          <section key={request.id} className="border border-slate-200 bg-white p-5">
            <div className="flex flex-col justify-between gap-4 lg:flex-row">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><h2 className="font-semibold text-slate-900">{request.order?.address || "Order unavailable"}</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{request.status}</span></div>
                <p className="mt-1 text-sm text-slate-500">{request.order?.orderNumber} · {request.order?.realtor.firstName} {request.order?.realtor.lastName}{request.order?.realtor.brokerageName ? ` · ${request.order.realtor.brokerageName}` : ""}</p>
                <p className="mt-2 text-sm text-slate-600">Requested by {request.requestedBy ? `${request.requestedBy.firstName} ${request.requestedBy.lastName} (${request.requestedBy.email})` : "Unknown user"} · {request.requesterRole}</p>
                <a href={request.requestedUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block break-all text-base font-semibold text-sky-700 underline">{request.requestedUrl}</a>
                {request.order?.rfidListingUrl && <p className="mt-2 break-all text-sm text-slate-500">Current approved link: {request.order.rfidListingUrl}</p>}
              </div>
              {request.status === "PENDING" && <div className="w-full shrink-0 lg:w-80"><label className="text-sm font-medium text-slate-700">Review note<textarea value={notes[request.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Required when rejecting" className="mt-1 min-h-20 w-full rounded-md border border-slate-300 p-3 text-sm" /></label><div className="mt-3 flex gap-2"><button type="button" onClick={() => void review(request.id, "REJECTED")} disabled={busyId === request.id} className="h-10 flex-1 rounded-md border border-red-300 font-semibold text-red-700 disabled:opacity-50">Reject</button><button type="button" onClick={() => void review(request.id, "APPROVED")} disabled={busyId === request.id} className="h-10 flex-1 rounded-md bg-emerald-700 font-semibold text-white disabled:opacity-50">Approve</button></div></div>}
              {request.status !== "PENDING" && request.reviewNotes && <p className="max-w-sm rounded-md bg-slate-50 p-3 text-sm text-slate-700">{request.reviewNotes}</p>}
            </div>
          </section>
        ))}
        {requests.length === 0 && <EmptyState title={`No ${status.toLowerCase()} listing links`} description="Submitted listing websites will appear here for review." />}
      </div>
    </div>
  );
}