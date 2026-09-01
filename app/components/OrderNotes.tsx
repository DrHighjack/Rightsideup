"use client";

import { useMemo } from "react";

type StreetViewReference = {
  imageUrl: string;
  camera?: string;
  markedPoint?: string;
  coordinates?: string;
  note?: string;
};

function parseOrderNotes(notes: string) {
  const marker = "[Street View Placement References]";
  const markerIndex = notes.indexOf(marker);
  if (markerIndex === -1) return { text: notes, references: [] as StreetViewReference[] };

  const text = notes.slice(0, markerIndex).trim();
  const referenceText = notes.slice(markerIndex + marker.length).trim();
  const references: StreetViewReference[] = [];
  referenceText.split(/\n(?=\d+\.\s+https?:\/\/)/).forEach((entry) => {
      const lines = entry.split("\n").map((line) => line.trim());
      const imageUrl = lines[0]?.replace(/^\d+\.\s+/, "") || "";
      if (!/^https:\/\/maps\.googleapis\.com\/maps\/api\/streetview\?/.test(imageUrl)) return;
      const field = (label: string) => lines.find((line) => line.startsWith(label))?.slice(label.length).trim();
      references.push({
        imageUrl,
        camera: field("Camera:"),
        markedPoint: field("Marked point:"),
        coordinates: field("Sign coordinates:"),
        note: field("Note:"),
      });
    });

  return { text, references };
}

export function OrderNotes({ notes, title = "Notes", compact = false }: { notes?: string | null; title?: string; compact?: boolean }) {
  const parsed = useMemo(() => parseOrderNotes(notes || ""), [notes]);
  if (!notes) return null;

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      {parsed.text && <p className="mt-1 whitespace-pre-wrap text-base text-slate-900">{parsed.text}</p>}
      {parsed.references.length > 0 && (
        <div className="mt-4 space-y-4">
          <p className="text-sm font-semibold text-slate-900">Street View placement</p>
          {parsed.references.map((reference, index) => (
            <figure key={`${reference.imageUrl}-${index}`} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <img src={reference.imageUrl} alt={`Street View placement reference ${index + 1}`} className={`w-full object-cover ${compact ? "max-h-48" : "max-h-96"}`} />
              <figcaption className="space-y-1 p-3 text-xs text-slate-600">
                {reference.camera && <p>{reference.camera}</p>}
                {reference.markedPoint && <p>{reference.markedPoint}</p>}
                {reference.coordinates && <p>{reference.coordinates}</p>}
                {reference.note && <p>{reference.note}</p>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
