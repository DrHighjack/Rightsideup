"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/app/components/EmptyState";

type AccountRequest = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: "TC" | "BROKERAGE";
  accountStatus: "PENDING_APPROVAL" | "APPROVED";
  emailVerifiedAt: string | null;
  brokerage: { id: string; name: string; isActive: boolean } | null;
  createdAt: string;
};

export default function AdminAccountRequestsPage() {
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function loadRequests() {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/account-requests");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load account requests");
      setRequests(data.requests || []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load account requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadRequests(); }, []);

  async function takeAction(userId: string, action: "APPROVE" | "ACTIVATE" | "REJECT") {
    try {
      setBusyId(userId);
      setError("");
      const response = await fetch("/api/admin/account-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update account request");
      await loadRequests();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update account request");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Account management</p>
        <h1 className="mt-1 text-3xl font-semibold text-slate-900">Account requests</h1>
        <p className="mt-2 text-slate-600">Approve each request, then activate it after the user verifies their email.</p>
      </div>

      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading account requests...</p>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <section key={request.id} className="border border-slate-200 bg-white p-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-900">{request.firstName} {request.lastName}</h2>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {request.role === "TC" ? "Transaction Coordinator" : "Brokerage"}
                    </span>
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                      {request.accountStatus === "PENDING_APPROVAL" ? "Pending approval" : "Approved, inactive"}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-sm text-slate-600">{request.email}</p>
                  {request.phone && <p className="mt-1 text-sm text-slate-600">{request.phone}</p>}
                  {request.brokerage && <p className="mt-1 text-sm text-slate-600">Brokerage: {request.brokerage.name}</p>}
                  <p className="mt-2 text-xs text-slate-500">
                    Submitted {new Date(request.createdAt).toLocaleDateString()} · Email {request.emailVerifiedAt ? "verified" : "not verified"}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  {request.accountStatus === "PENDING_APPROVAL" ? (
                    <>
                      <button type="button" onClick={() => void takeAction(request.id, "REJECT")} disabled={busyId === request.id} className="h-10 rounded-md border border-red-300 px-4 font-semibold text-red-700 disabled:opacity-50">Reject</button>
                      <button type="button" onClick={() => void takeAction(request.id, "APPROVE")} disabled={busyId === request.id} className="h-10 rounded-md bg-emerald-700 px-4 font-semibold text-white disabled:opacity-50">Approve</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => void takeAction(request.id, "REJECT")} disabled={busyId === request.id} className="h-10 rounded-md border border-red-300 px-4 font-semibold text-red-700 disabled:opacity-50">Reject</button>
                      <button type="button" onClick={() => void takeAction(request.id, "ACTIVATE")} disabled={busyId === request.id || !request.emailVerifiedAt} title={!request.emailVerifiedAt ? "Email verification is required before activation" : "Activate account"} className="h-10 rounded-md bg-navy-900 px-4 font-semibold text-white disabled:opacity-50">Activate</button>
                    </>
                  )}
                </div>
              </div>
            </section>
          ))}
          {requests.length === 0 && <EmptyState title="No account requests" description="TC and Brokerage signups awaiting approval will appear here." />}
        </div>
      )}
    </div>
  );
}