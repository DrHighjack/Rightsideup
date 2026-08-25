import { notFound } from "next/navigation";
import { getPublicSmartSignContext } from "@/lib/smart-sign";
import { TapTracker } from "./TapTracker";

export const dynamic = "force-dynamic";

function photoUrls(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((photo) => typeof photo === "object" && photo ? (photo as { url?: unknown; pathname?: unknown }).url || (photo as { pathname?: unknown }).pathname : null)
    .filter((url): url is string => typeof url === "string" && /^https?:\/\/|^\//.test(url));
}

export default async function SmartSignLandingPage({ params }: { params: { tagCode: string } }) {
  const context = await getPublicSmartSignContext(params.tagCode);
  if (!context) notFound();

  const { tag, isLive } = context;
  if (!isLive) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-16 text-white">
        <section className="mx-auto max-w-md text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">North Shore Sign Co</p>
          <h1 className="mt-5 text-4xl font-semibold">Ask your agent about this listing.</h1>
          <p className="mt-4 text-slate-300">This Smart Sign is not currently sharing live listing details.</p>
          <TapTracker tagCode={params.tagCode} />
        </section>
      </main>
    );
  }

  const order = tag.sign.assignedToOrder!;
  const agent = tag.sign.assignedToUser!;
  const images = photoUrls(order.photos);
  const heroImage = images[0];
  const agentName = `${agent.firstName} ${agent.lastName}`.trim();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">North Shore Sign Co</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-5xl">{order.address}</h1>
        <p className="mt-3 text-base text-slate-600">Listing details shared by {agentName}</p>

        {heroImage ? (
          <img src={heroImage} alt={`Listing at ${order.address}`} className="mt-7 aspect-[16/10] w-full rounded-lg object-cover shadow-sm" />
        ) : (
          <div className="mt-7 flex aspect-[16/10] items-center justify-center rounded-lg bg-slate-200 text-sm text-slate-500">Listing details available from the agent</div>
        )}

        <section className="mt-7 border-y border-slate-200 py-6">
          <p className="text-sm font-medium text-slate-500">Your listing agent</p>
          <p className="mt-1 text-xl font-semibold">{agentName}</p>
          {agent.phone && <a href={`tel:${agent.phone}`} className="mt-3 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Call {agentName}</a>}
          {!agent.phone && <a href={`mailto:${agent.email}`} className="mt-3 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Contact {agentName}</a>}
        </section>

        {images.length > 1 && (
          <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.slice(1, 7).map((image, index) => <img key={image} src={image} alt={`Listing photo ${index + 2}`} className="aspect-square w-full rounded-md object-cover" />)}
          </section>
        )}
        <TapTracker tagCode={params.tagCode} />
      </div>
    </main>
  );
}
