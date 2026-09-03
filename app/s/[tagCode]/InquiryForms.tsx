"use client";

import { useState } from "react";

type InquiryFormsProps = { tagCode: string; orderId: string; agentName: string };

export function InquiryForms({ tagCode, orderId, agentName }: InquiryFormsProps) {
  const [activeForm, setActiveForm] = useState<"contact" | "reminder" | null>(null);
  const [contact, setContact] = useState({ name: "", phone: "", email: "", message: "" });
  const [reminder, setReminder] = useState({ phone: "", email: "", notifyWhen: "SOLD", termsAccepted: false });
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(inquiryType: "CONTACT" | "REMINDER") {
    const values = inquiryType === "CONTACT" ? { ...contact, termsAccepted: false } : reminder;
    try {
      setSaving(true);
      setStatus("");
      const response = await fetch(`/api/smart-sign/${encodeURIComponent(tagCode)}/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, inquiryType, orderId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit your request");
      setStatus(inquiryType === "CONTACT" ? `${agentName} will be in touch soon.` : "You are signed up for listing updates.");
      setActiveForm(null);
      setContact({ name: "", phone: "", email: "", message: "" });
      setReminder({ phone: "", email: "", notifyWhen: "SOLD", termsAccepted: false });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to submit your request");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-7 border-y border-slate-200 py-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => setActiveForm(activeForm === "contact" ? null : "contact")} className="rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Contact Agent</button>
        <button type="button" onClick={() => setActiveForm(activeForm === "reminder" ? null : "reminder")} className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800">Remind Me When This Sells</button>
      </div>

      {activeForm === "contact" && <form onSubmit={(event) => { event.preventDefault(); void submit("CONTACT"); }} className="mt-5 space-y-3">
        <h2 className="text-lg font-semibold">Contact {agentName}</h2>
        <input required placeholder="Name" value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
        <div className="grid gap-3 sm:grid-cols-2"><input required type="tel" placeholder="Phone number" value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2" /><input required type="email" placeholder="Email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2" /></div>
        <textarea required rows={3} placeholder="Short message" value={contact.message} onChange={(event) => setContact({ ...contact, message: event.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
        <button disabled={saving} className="rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Sending..." : "Send Message"}</button>
      </form>}

      {activeForm === "reminder" && <form onSubmit={(event) => { event.preventDefault(); void submit("REMINDER"); }} className="mt-5 space-y-3">
        <h2 className="text-lg font-semibold">Get listing updates</h2>
        <div className="grid gap-3 sm:grid-cols-2"><input required type="tel" placeholder="Phone number" value={reminder.phone} onChange={(event) => setReminder({ ...reminder, phone: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2" /><input required type="email" placeholder="Email" value={reminder.email} onChange={(event) => setReminder({ ...reminder, email: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2" /></div>
        <label className="block text-sm font-medium text-slate-700">When should we notify you?<select value={reminder.notifyWhen} onChange={(event) => setReminder({ ...reminder, notifyWhen: event.target.value })} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"><option value="SOLD">When it sells</option><option value="PENDING">When it goes pending</option><option value="OFF_MARKET">When it is off the market</option></select></label>
        <label className="flex gap-2 text-xs leading-5 text-slate-600"><input required type="checkbox" checked={reminder.termsAccepted} onChange={(event) => setReminder({ ...reminder, termsAccepted: event.target.checked })} className="mt-1" />By submitting, you agree that North Shore Sign Co LLC and the listing agent may contact you by phone, text, or email about this property and your request. Consent is not required to purchase. Message and data rates may apply. You agree to the <a href="/terms" target="_blank" className="underline">Terms & Conditions</a> and <a href="/privacy" target="_blank" className="underline">Privacy Policy</a>.</label>
        <button disabled={saving} className="rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Sign Me Up"}</button>
      </form>}
      {status && <p role="status" className="mt-4 text-sm font-medium text-slate-700">{status}</p>}
    </section>
  );
}