"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface Realtor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  brokerageName?: string | null;
}

interface PendingInvite {
  id: string;
  email: string;
  expiresAt: string;
}

export default function MyAgentsPage() {
  const { data: session, status } = useSession();
  const userRole = (session?.user as any)?.role as string | undefined;
  const isTC = userRole === "TC";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [agents, setAgents] = useState<Realtor[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);

  const [showAddRealtor, setShowAddRealtor] = useState(false);
  const [addingRealtor, setAddingRealtor] = useState(false);
  const [addRealtorMessage, setAddRealtorMessage] = useState("");
  const [addRealtorData, setAddRealtorData] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });

  const fetchAgents = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/tc/realtors", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load your agents");
      }

      const data = await response.json();
      setAgents(Array.isArray(data.realtors) ? data.realtors : []);
      setPendingInvites(Array.isArray(data.pendingInvites) ? data.pendingInvites : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load your agents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isTC) {
      setLoading(false);
      return;
    }
    fetchAgents();
  }, [isTC]);

  const handleAddRealtor = async () => {
    setAddRealtorMessage("");

    if (!addRealtorData.firstName || !addRealtorData.lastName || !addRealtorData.email) {
      setAddRealtorMessage("Please fill first name, last name, and email.");
      return;
    }

    try {
      setAddingRealtor(true);
      const response = await fetch("/api/tc/realtors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addRealtorData),
      });

      const data = await response.json();
      if (!response.ok) {
        setAddRealtorMessage(data.error || "Failed to add realtor");
        return;
      }

      if (data?.linked && data?.realtor?.id) {
        setAgents((prev) => {
          const already = prev.some((r) => r.id === data.realtor.id);
          if (already) return prev;
          return [data.realtor, ...prev];
        });
        setAddRealtorMessage("Realtor added and linked successfully.");
      } else if (data?.invited && data?.pendingInvite) {
        setPendingInvites((prev) => [data.pendingInvite, ...prev]);
        setAddRealtorMessage("Invitation sent. Realtor must complete registration.");
      }

      setAddRealtorData({ firstName: "", lastName: "", email: "" });
      setShowAddRealtor(false);
    } catch (_error) {
      setAddRealtorMessage("Failed to add realtor");
    } finally {
      setAddingRealtor(false);
    }
  };

  if (status === "loading" || loading) {
    return <div className="text-sm text-slate-600">Loading agents...</div>;
  }

  if (!isTC) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        This page is available for Transaction Coordinators only.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">My Agents</h1>
          <p className="text-slate-600 mt-1">Manage your realtor clients and quickly place install or removal orders.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddRealtor((prev) => !prev)}
          className="inline-flex h-11 items-center rounded-lg bg-green-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-green-700"
        >
          Add Realtor
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {showAddRealtor && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
          <h2 className="font-semibold text-green-900">Add Realtor To Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={addRealtorData.firstName}
              onChange={(e) => setAddRealtorData((prev) => ({ ...prev, firstName: e.target.value }))}
              placeholder="First Name"
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
              disabled={addingRealtor}
            />
            <input
              type="text"
              value={addRealtorData.lastName}
              onChange={(e) => setAddRealtorData((prev) => ({ ...prev, lastName: e.target.value }))}
              placeholder="Last Name"
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
              disabled={addingRealtor}
            />
            <input
              type="email"
              value={addRealtorData.email}
              onChange={(e) => setAddRealtorData((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
              disabled={addingRealtor}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddRealtor(false)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"
              disabled={addingRealtor}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddRealtor}
              className="h-10 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              disabled={addingRealtor}
            >
              {addingRealtor ? "Adding..." : "Add Realtor"}
            </button>
          </div>
          {addRealtorMessage && (
            <div className="rounded-lg border border-green-200 bg-white px-3 py-2 text-xs text-green-800">
              {addRealtorMessage}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Brokerage</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                    No clients yet. Use Add Realtor to build your team.
                  </td>
                </tr>
              ) : (
                agents.map((agent) => (
                  <tr key={agent.id}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {agent.firstName} {agent.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{agent.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{agent.brokerageName || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/my-agents/${agent.id}`}
                          className="inline-flex h-9 items-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          View Profile
                        </Link>
                        <Link
                          href={`/dashboard/orders/new?realtorId=${agent.id}&type=INSTALL`}
                          className="inline-flex h-9 items-center rounded-lg border border-navy-300 bg-navy-50 px-3 text-xs font-semibold text-navy-800 hover:bg-navy-100"
                        >
                          Place Install
                        </Link>
                        <Link
                          href={`/dashboard/orders/new?realtorId=${agent.id}&type=REMOVAL`}
                          className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Place Removal
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pendingInvites.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-800 mb-2">Pending Invites</p>
          <div className="space-y-1">
            {pendingInvites.map((invite) => (
              <p key={invite.id} className="text-xs text-amber-700">
                {invite.email} - expires {new Date(invite.expiresAt).toLocaleDateString()}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
