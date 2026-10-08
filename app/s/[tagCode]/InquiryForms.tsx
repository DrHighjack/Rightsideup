"use client";

import { useState } from "react";
import { LISTING_SMS_CONSENT_DISCLOSURE } from "@/lib/sms-consent";

type InquiryFormsProps = { tagCode: string; orderId: string; agentName: string; units?: string[]; contactLabel?: "Agent" | "Landlord" };

export function InquiryForms({ tagCode, orderId, agentName, units = [], contactLabel = "Agent" }: InquiryFormsProps) {
  const [activeForm, setActiveForm] = useState<"contact" | "reminder" | null>(null);
  const [contact, setContact] = useState({ name: "", phone: "", email: "", message: "" });
  const [selectedUnit, setSelectedUnit] = useState("");
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
        body: JSON.stringify({ ...values, inquiryType, orderId, ...(inquiryType === "CONTACT" && units.length > 0 ? { unit: selectedUnit } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit your request");
      setStatus(inquiryType === "CONTACT" ? `${agentName} will be in touch soon.` : "Your text update request has been sent to the listing agent.");
      setActiveForm(null);
      setContact({ name: "", phone: "", email: "", message: "" });
      setSelectedUnit("");
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
        <button type="button" onClick={() => setActiveForm(activeForm === "contact" ? null : "contact")} className="rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Contact {contactLabel}</button>
        <button type="button" onClick={() => setActiveForm(activeForm === "reminder" ? null : "reminder")} className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800">Request text updates</button>
      </div>

      {activeForm === "contact" && <form onSubmit={(event) => { event.preventDefault(); void submit("CONTACT"); }} className="mt-5 space-y-3">
        <h2 className="text-lg font-semibold">Contact {agentName}</h2>
        {units.length > 0 && <label className="block text-sm font-medium text-slate-700">Which unit are you interested in?
          <select required value={selectedUnit} onChange={(event) => setSelectedUnit(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2">
            <option value="">Select a unit</option>
            {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </label>}
        <input required placeholder="Name" value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
        <div className="grid gap-3 sm:grid-cols-2"><input required type="tel" placeholder="Phone number" value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2" /><input required type="email" placeholder="Email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2" /></div>
        <textarea required rows={3} placeholder="Short message" value={contact.message} onChange={(event) => setContact({ ...contact, message: event.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" />
        <button disabled={saving} className="rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Sending..." : "Send Message"}</button>
      </form>}

      {activeForm === "reminder" && <form onSubmit={(event) => { event.preventDefault(); void submit("REMINDER"); }} className="mt-5 space-y-3">
        <h2 className="text-lg font-semibold">Request listing text updates</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">Mobile number
            <input required type="tel" autoComplete="tel" placeholder="+12065551234" pattern="\+[1-9][0-9]{7,14}" value={reminder.phone} onChange={(event) => setReminder({ ...reminder, phone: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">Email
            <input required type="email" autoComplete="email" value={reminder.email} onChange={(event) => setReminder({ ...reminder, email: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">When should we notify you?<select value={reminder.notifyWhen} onChange={(event) => setReminder({ ...reminder, notifyWhen: event.target.value })} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"><option value="SOLD">When it sells</option><option value="PENDING">When it goes pending</option><option value="OFF_MARKET">When it is off the market</option></select></label>
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm font-medium text-slate-800"><input required type="checkbox" aria-describedby="listing-sms-disclosure" checked={reminder.termsAccepted} onChange={(event) => setReminder({ ...reminder, termsAccepted: event.target.checked })} className="mt-1 h-5 w-5 shrink-0 accent-primary" />Allow NSSC to text you</label>
          <p id="listing-sms-disclosure" className="pl-7 text-sm leading-6 text-slate-600">{LISTING_SMS_CONSENT_DISCLOSURE}</p>
          <p className="pl-7 text-sm text-slate-600"><a href="/terms#sms-notifications" target="_blank" rel="noopener noreferrer" className="underline">SMS Terms &amp; Conditions</a>{" and "}<a href="/privacy#sms-privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>. For help, contact billing@northshoresignco.com.</p>
        </div>
        <button disabled={saving} className="rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Request texts"}</button>
      </form>}
      {status && <p role="status" className="mt-4 text-sm font-medium text-slate-700">{status}</p>}
    </section>
  );
}