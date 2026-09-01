import { notFound } from "next/navigation";
import { getPublicSmartSignContextBySignId, getPublicTapMortgageCta } from "@/lib/smart-sign";
import { TapTracker } from "../../s/[tagCode]/TapTracker";

export const dynamic = "force-dynamic";

function photoUrls(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((photo) => typeof photo === "object" && photo ? (photo as { url?: unknown; pathname?: unknown }).url || (photo as { pathname?: unknown }).pathname : null)
    .filter((url): url is string => typeof url === "string" && /^https?:\/\/|^\//.test(url));
}

export default async function TapLandingPage({ params }: { params: { signId: string } }) {
  const [context, cta] = await Promise.all([getPublicSmartSignContextBySignId(params.signId), getPublicTapMortgageCta()]);
  if (!context || !context.sign) notFound();

  const { tag, sign, isLive, hasActiveListing, listingUrl } = context;
  const signLabel = sign.signNumber || params.signId;

  if (!tag || !sign.assignedToUser || !sign.assignedToOrder || !isLive || !hasActiveListing) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
        <section className="mx-auto max-w-sm rounded-[28px] border border-slate-800 bg-slate-900/80 p-6 text-center shadow-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-300">North Shore Sign Co</p>
          <h1 className="mt-5 text-3xl font-semibold leading-tight">{hasActiveListing ? "Ask your agent about this listing." : "Coming soon."}</h1>
          <p className="mt-3 text-sm text-slate-300">{hasActiveListing ? "This sign is not currently sharing live listing details." : `This sign (${signLabel}) is not currently assigned to an active listing.`}</p>
          <TapTracker signId={params.signId} />
        </section>
      </main>
    );
  }

  const order = sign.assignedToOrder;
  const agent = sign.assignedToUser;
  const images = photoUrls(order.photos);
  const heroImage = images[0];
  const agentName = `${agent.firstName} ${agent.lastName}`.trim();

  return (
    <main className="min-h-screen bg-[#f5f1eb] px-4 py-5 text-slate-900">
      <div className="mx-auto max-w-[440px] rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <div className="px-4 pb-5 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-700">North Shore Sign Co</p>
          <h1 className="mt-3 text-[2rem] font-semibold leading-[1.05] tracking-[-0.04em]">{order.address}</h1>
          <p className="mt-2 text-sm text-slate-600">Listing details shared by {agentName}</p>

          {heroImage ? (
            <img src={heroImage} alt={`Listing at ${order.address}`} className="mt-4 aspect-[4/3] w-full rounded-2xl object-cover" />
          ) : (
            <div className="mt-4 flex aspect-[4/3] items-center justify-center rounded-2xl bg-slate-200 text-sm text-slate-500">Listing details available from the agent</div>
          )}

          <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Your listing agent</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{agentName}</p>
            <div className="mt-3 flex gap-2">
              {agent.phone && <a href={`tel:${agent.phone}`} className="inline-flex flex-1 items-center justify-center rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white">Call</a>}
              <a href={`mailto:${agent.email}`} className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800">Email</a>
            </div>
          </section>

          {listingUrl && (
            <a href={listingUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-sky-700 px-3 py-3 text-sm font-semibold text-white">
              View Full Listing
            </a>
          )}

          {images.length > 1 && (
            <section className="mt-5 grid grid-cols-2 gap-2">
              {images.slice(1, 5).map((image, index) => <img key={image} src={image} alt={`Listing photo ${index + 2}`} className="aspect-square w-full rounded-xl object-cover" />)}
            </section>
          )}

          {cta.enabled && (
            <section className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-sky-700">Need financing?</p>
              <p className="mt-2 text-base font-semibold text-slate-900">Get a free rate check</p>
              <a href={cta.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-3 py-2.5 text-sm font-semibold text-white">Talk to Ratican Mortgage</a>
            </section>
          )}

          <div className="mt-5 border-t border-slate-200 pt-4">
            <TapTracker signId={params.signId} />
          </div>
        </div>
      </div>
    </main>
  );
}
