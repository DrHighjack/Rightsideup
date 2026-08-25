"use client";

import { useEffect, useState } from "react";

type UntaggedSign = { id: string; signNumber: string | null; type: string; status: string; deployedAddress: string | null; assignedToUser: { id: string; firstName: string; lastName: string } | null };
type Tag = { id: string; tagCode: string; isActive: boolean; notes: string | null; installedAt: string; tapCount: number; url: string; sign: { signNumber: string | null; status: string; deployedAddress: string | null; assignedToUser: { firstName: string; lastName: string; email: string } | null; assignedToOrder: { orderNumber: string; address: string } | null } };

export default function AdminSmartSignPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [signs, setSigns] = useState<UntaggedSign[]>([]);
  const [signId, setSignId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/smart-sign");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load Smart Sign tags");
      setTags(data.tags || []);
      setSigns(data.untaggedSigns || []);
      setSignId((current) => current || data.untaggedSigns?.[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Smart Sign tags");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const provision = async () => {
    if (!signId) return;
    try {
      setSaving(true);
      setError("");
      const response = await fetch("/api/admin/smart-sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signId, notes }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to provision tag");
      setNotes("");
      await load();
    } catch (provisionError) {
      setError(provisionError instanceof Error ? provisionError.message : "Unable to provision tag");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (tag: Tag) => {
    try {
      setSaving(true);
      const response = await fetch("/api/admin/smart-sign", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tag.id, isActive: !tag.isActive, notes: tag.notes || "" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update tag");
      setTags((current) => current.map((item) => item.id === tag.id ? { ...item, ...data.tag } : item));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update tag");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-600">Loading Smart Sign inventory...</div>;

  return <div className="space-y-6">
    <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Phase 6</p><h1 className="mt-1 text-3xl font-semibold text-slate-900">Smart Sign pilot</h1><p className="mt-2 text-slate-600">Provision a reusable NFC + QR tag to a physical post. If the post is currently assigned, the agent’s 90-day trial starts automatically.</p></div>
    {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <section className="border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">Provision a post</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_auto] md:items-end">
        <label className="text-sm font-medium text-slate-700">Physical post
          <select value={signId} onChange={(event) => setSignId(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900">
            <option value="">Select a post</option>{signs.map((sign) => <option key={sign.id} value={sign.id}>{sign.signNumber || sign.type} · {sign.status} · {sign.deployedAddress || "not deployed"}{sign.assignedToUser ? ` · ${sign.assignedToUser.firstName} ${sign.assignedToUser.lastName}` : ""}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Install notes
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Both sides tagged" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900" />
        </label>
        <button type="button" onClick={() => void provision()} disabled={saving || !signId} className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-50">{saving ? "Provisioning..." : "Create QR / NFC URL"}</button>
      </div>
    </section>
    <section className="border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold text-slate-900">Tagged posts</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="border-b text-left text-xs uppercase text-slate-500"><tr><th className="py-3 pr-4">Post</th><th className="py-3 pr-4">Current listing / agent</th><th className="py-3 pr-4">Public URL</th><th className="py-3 pr-4 text-right">Taps</th><th className="py-3 text-right">Routing</th></tr></thead><tbody>{tags.map((tag) => <tr key={tag.id} className="border-b border-slate-100"><td className="py-4 pr-4 font-medium">{tag.sign.signNumber || "Unlabeled post"}<p className="text-xs font-normal text-slate-500">{tag.tagCode}</p></td><td className="py-4 pr-4">{tag.sign.assignedToOrder?.address || tag.sign.deployedAddress || "No active listing"}<p className="text-xs text-slate-500">{tag.sign.assignedToUser ? `${tag.sign.assignedToUser.firstName} ${tag.sign.assignedToUser.lastName}` : "Unassigned"}</p></td><td className="py-4 pr-4"><a href={tag.url} target="_blank" rel="noreferrer" className="font-medium text-sky-700 hover:text-sky-900">Open landing page</a></td><td className="py-4 pr-4 text-right font-semibold">{tag.tapCount}</td><td className="py-4 text-right"><button type="button" onClick={() => void toggle(tag)} disabled={saving} className={`rounded-md px-3 py-1.5 font-medium ${tag.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{tag.isActive ? "Live" : "Paused"}</button></td></tr>)}</tbody></table>{tags.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No physical posts have been tagged yet.</p>}</div></section>
  </div>;
}
