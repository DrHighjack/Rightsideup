"use client";

import { useEffect, useState } from "react";
import { FieldTabs } from "../FieldTabs";

type Assignment = {
  id: string;
  scheduledFor: string | null;
  order: {
    id: string;
    orderNumber: string;
    address: string;
    rfidListingUrl: string | null;
    realtor: { firstName: string; lastName: string };
  };
};

type NdefReader = {
  scan: () => Promise<void>;
  addEventListener: (type: "reading", listener: (event: { message: { records: Array<{ data?: ArrayBuffer; recordType?: string }> } }) => void, options?: { once?: boolean }) => void;
};

export default function PairNfcPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [orderId, setOrderId] = useState("");
  const [tagReference, setTagReference] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string; publicUrl?: string } | null>(null);

  useEffect(() => {
    void fetch("/api/field/nfc-pairing")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load assigned listings");
        setAssignments(data.assignments || []);
        const first = data.assignments?.[0];
        if (first) {
          setOrderId(first.order.id);
          setListingUrl(first.order.rfidListingUrl || "");
        }
      })
      .catch((error) => setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to load assigned listings" }))
      .finally(() => setLoading(false));
  }, []);

  function selectOrder(nextOrderId: string) {
    setOrderId(nextOrderId);
    const assignment = assignments.find((item) => item.order.id === nextOrderId);
    setListingUrl(assignment?.order.rfidListingUrl || "");
    setMessage(null);
  }

  async function scanTag() {
    const NDEFReaderConstructor = (window as typeof window & { NDEFReader?: new () => NdefReader }).NDEFReader;
    if (!NDEFReaderConstructor) {
      setMessage({ type: "error", text: "NFC scanning is not available in this browser. Paste the box URL or enter its printed code." });
      return;
    }

    try {
      setScanning(true);
      setMessage(null);
      const reader = new NDEFReaderConstructor();
      await reader.scan();
      reader.addEventListener("reading", (event) => {
        const record = event.message.records.find((item) => item.data);
        if (!record?.data) {
          setMessage({ type: "error", text: "The NFC box did not contain a readable URL." });
          setScanning(false);
          return;
        }
        setTagReference(new TextDecoder().decode(record.data));
        setMessage({ type: "success", text: "NFC box read. Review the listing and pair it." });
        setScanning(false);
      }, { once: true });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to scan the NFC box" });
      setScanning(false);
    }
  }

  async function pairTag() {
    try {
      setSaving(true);
      setMessage(null);
      const response = await fetch("/api/field/nfc-pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagReference, orderId, listingUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to pair NFC box");
      setMessage({ type: "success", text: `Paired to ${data.listingAddress}${data.signNumber ? ` on post ${data.signNumber}` : ""}.`, publicUrl: data.publicUrl });
      setTagReference("");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to pair NFC box" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-10 bg-ink px-4 py-4 text-white">
        <p className="text-xs font-semibold uppercase text-sky-300">Installer tools</p>
        <h1 className="mt-1 text-2xl font-semibold">Pair NFC box</h1>
      </header>

      <div className="mx-auto max-w-xl space-y-4 p-4">
        {message && (
          <div className={`rounded-lg border p-4 text-sm ${message.type === "success" ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"}`} role="status">
            <p>{message.text}</p>
            {message.publicUrl && <a href={message.publicUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-blue-700 underline">Test public page</a>}
          </div>
        )}

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <label htmlFor="listing" className="block text-sm font-semibold text-gray-800">Assigned listing</label>
          <select id="listing" value={orderId} onChange={(event) => selectOrder(event.target.value)} disabled={loading} className="mt-2 h-12 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900">
            <option value="">Select a listing</option>
            {assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.order.id}>{assignment.order.address} · {assignment.order.orderNumber}</option>
            ))}
          </select>
          {!loading && assignments.length === 0 && <p className="mt-3 text-sm text-gray-600">You have no open install or change jobs available for pairing.</p>}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <label htmlFor="tagReference" className="block text-sm font-semibold text-gray-800">NFC box URL or code</label>
          <input id="tagReference" value={tagReference} onChange={(event) => setTagReference(event.target.value)} placeholder="Tap Scan NFC or enter the printed code" autoCapitalize="characters" className="mt-2 h-12 w-full rounded-lg border border-gray-300 px-3 text-base text-gray-900" />
          <button type="button" onClick={() => void scanTag()} disabled={scanning} className="mt-3 h-12 w-full rounded-lg border-2 border-blue-600 bg-white font-semibold text-blue-700 disabled:opacity-50">
            {scanning ? "Hold phone near NFC box..." : "Scan NFC Box"}
          </button>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <label htmlFor="listingUrl" className="block text-sm font-semibold text-gray-800">Listing website</label>
          <input id="listingUrl" type="url" inputMode="url" value={listingUrl} onChange={(event) => setListingUrl(event.target.value)} placeholder="https://listing.example.com" className="mt-2 h-12 w-full rounded-lg border border-gray-300 px-3 text-base text-gray-900" />
        </section>

        <button type="button" onClick={() => void pairTag()} disabled={saving || !orderId || !tagReference.trim() || !listingUrl.trim()} className="h-14 w-full rounded-lg bg-blue-600 px-4 text-lg font-bold text-white active:bg-blue-700 disabled:opacity-50">
          {saving ? "Pairing..." : "Pair NFC to Listing"}
        </button>
      </div>
      <FieldTabs />
    </main>
  );
}