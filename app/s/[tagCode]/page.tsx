import { notFound } from "next/navigation";
import { getPublicSmartSignContext } from "@/lib/smart-sign";
import { TapTracker } from "./TapTracker";
import { InquiryForms } from "./InquiryForms";

export const dynamic = "force-dynamic";

function photoUrls(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((photo) => typeof photo === "object" && photo ? (photo as { url?: unknown; pathname?: unknown }).url || (photo as { pathname?: unknown }).pathname : null)
    .filter((url): url is string => typeof url === "string" && /^https?:\/\/|^\//.test(url));
}

const twinBrooksPhotos = [
  "https://photos.zillowstatic.com/fp/0024ba111e434c3e098c1bc7653657a8-d_d.webp",
  "https://photos.zillowstatic.com/fp/1568d57bf2b77646cf652a9ce12af0af-d_d.webp",
  "https://photos.zillowstatic.com/fp/3166852a093ee846594ac55263d14fe6-d_d.webp",
];

function getListingDetails(address: string) {
  if (address.toLowerCase().includes("10709 valley view")) {
    return {
      price: "$479,950",
      facts: ["3 beds", "2 baths", "Built 2003", "Contemporary", "$500 fees", "$4,010 taxes"],
      description: "Finding a 3-bedroom condo in an amazing Downtown Bothell location is rare. This ground-floor corner unit offers true one-level living, 2 parking spaces, no rental cap, an open-concept living space, fresh interior paint, engineered wood floors, new carpet, a stone eat-in bar, a cozy gas fireplace, and a private outdoor patio. The primary suite includes a walk-in closet and en-suite bath, while two additional bedrooms offer flexibility for guests, an office, or hobbies. Full-size in-unit laundry and two storage units make everyday living easy, with downtown restaurants, shops, UW Bothell, Bothell Landing, and the Burke-Gilman Trail nearby.",
      mls: "MLS #2577646",
      disclaimer: "Listing information is provided for personal, noncommercial use and is based on information supplied by the listing source. It is not guaranteed and should be independently reviewed and verified. North Shore Sign Co LLC is not the listing broker and does not endorse any real estate professional.",
    };
  }
  if (!address.toLowerCase().includes("518 twin brooks")) return null;
  return {
    price: "$795,000",
    facts: ["3 beds", "2 baths", "1,950 sq ft", "Built 2015", "10,389 sq ft lot", "$255/mo HOA"],
    description: "Nestled in the 55+ Twin Brooks community, this impeccably maintained Craftsman home offers bright open living, hardwood floors, air conditioning, a covered back patio, and a grand kitchen with quartz counters, tiled backsplash, stainless appliances, walk-in pantry, and center island. The no-step design includes a main-level primary suite, two guest bedrooms, a den, a 3-car garage, and access to community trails and a clubhouse.",
    mls: "MLS #2574910",
    disclaimer: "Information is provided for personal, noncommercial use and is based on information submitted to the MLS GRID. It is not guaranteed and should be independently reviewed and verified. North Shore Sign Co LLC is not the listing broker and does not endorse any real estate professional.",
  };
}

export default async function SmartSignLandingPage({ params }: { params: { tagCode: string } }) {
  const context = await getPublicSmartSignContext(params.tagCode);
  if (!context) notFound();

  const { tag, sign, isLive, hasActiveListing, listingUrl } = context;
  if (!tag || !sign) notFound();

  if (!isLive || !hasActiveListing || !sign.assignedToUser || !sign.assignedToOrder) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-16 text-white">
        <section className="mx-auto max-w-md text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">North Shore Sign Co</p>
          <h1 className="mt-5 text-4xl font-semibold">{hasActiveListing ? "Ask your agent about this listing." : "Coming soon."}</h1>
          <p className="mt-4 text-slate-300">{hasActiveListing ? "This Smart Sign is not currently sharing live listing details." : "This sign is in inventory or not yet assigned to an active listing."}</p>
          <TapTracker tagCode={params.tagCode} />
        </section>
      </main>
    );
  }

  const order = sign.assignedToOrder!;
  const agent = sign.assignedToUser!;
  const listingDetails = getListingDetails(order.address);
  const images = photoUrls(order.photos).length > 0 ? photoUrls(order.photos) : (listingDetails ? twinBrooksPhotos : []);
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

        {listingDetails && (
          <section className="mt-5 border-y border-slate-200 py-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">For sale</p>
                <p className="mt-1 text-3xl font-semibold text-slate-900">{listingDetails.price}</p>
              </div>
              <p className="text-sm text-slate-500">{listingDetails.mls}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-slate-700">
              {listingDetails.facts.map((fact) => <span key={fact}>{fact}</span>)}
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-600">{listingDetails.description}</p>
          </section>
        )}

        <section className="mt-7 border-y border-slate-200 py-6">
          <p className="text-sm font-medium text-slate-500">Your listing agent</p>
          <p className="mt-1 text-xl font-semibold">{agentName}</p>
          {agent.phone && <a href={`tel:${agent.phone}`} className="mt-3 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Call {agentName}</a>}
          {!agent.phone && <a href={`mailto:${agent.email}`} className="mt-3 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Contact {agentName}</a>}
        </section>

        <InquiryForms tagCode={params.tagCode} orderId={order.id} agentName={agentName} />

        {listingUrl && (
          <a href={listingUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
            See More Pictures
          </a>
        )}

        {images.length > 1 && (
          <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.slice(1, 7).map((image, index) => <img key={image} src={image} alt={`Listing photo ${index + 2}`} className="aspect-square w-full rounded-md object-cover" />)}
          </section>
        )}
        {listingDetails && <p className="mt-6 text-[11px] leading-5 text-slate-500">{listingDetails.disclaimer} <a href="https://www.zillow.com/mls-disclaimers/#39" target="_blank" rel="noreferrer" className="underline">MLS disclosure</a>.</p>}
        <TapTracker tagCode={params.tagCode} />
      </div>
    </main>
  );
}
