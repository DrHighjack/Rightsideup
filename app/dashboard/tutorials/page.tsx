interface TutorialItem {
  id: string;
  title: string;
  description: string;
  duration: string;
  audience: "Realtor" | "TC" | "Brokerage" | "All";
  videoUrl?: string;
}

const tutorials: TutorialItem[] = [
  {
    id: "create-order",
    title: "How To Create A New Order",
    description: "Walk through creating a complete order, selecting signs, and submitting.",
    duration: "3-5 min",
    audience: "Realtor",
  },
  {
    id: "inventory",
    title: "How To Check Inventory",
    description: "Show how to review available inventory and request more signs.",
    duration: "2-4 min",
    audience: "Realtor",
  },
  {
    id: "tracker-811",
    title: "How To Use 811 Tracker",
    description: "Explain ticket statuses and what to do when tickets change stages.",
    duration: "4-6 min",
    audience: "All",
  },
  {
    id: "invoices",
    title: "How To Pay Invoices",
    description: "Demonstrate invoice review, payment flow, and receipt confirmation.",
    duration: "2-3 min",
    audience: "All",
  },
  {
    id: "account-settings",
    title: "How To Update Account Settings",
    description: "Show password reset, contact updates, and profile maintenance.",
    duration: "2-3 min",
    audience: "All",
  },
  {
    id: "tc-workflow",
    title: "How TCs Manage Realtor Orders",
    description: "Cover linked accounts, order creation, and daily workflow tips for TCs.",
    duration: "5-7 min",
    audience: "TC",
  },
];

function getEmbedUrl(videoUrl?: string): string | null {
  if (!videoUrl) return null;

  try {
    const url = new URL(videoUrl);

    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      return v ? `https://www.youtube.com/embed/${v}` : null;
    }

    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.replace("/", "").trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (url.hostname.includes("vimeo.com")) {
      const id = url.pathname.replace("/", "").trim();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }

    return videoUrl;
  } catch {
    return null;
  }
}

export default function TutorialsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Tutorials</h1>
        <p className="mt-2 text-sm text-slate-600">
          Quick walkthroughs for common workflows. As videos are recorded, add links in
          this page and they will show up immediately.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {tutorials.map((tutorial) => {
          const embedUrl = getEmbedUrl(tutorial.videoUrl);

          return (
            <section
              key={tutorial.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-slate-900">{tutorial.title}</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {tutorial.audience}
                </span>
              </div>

              <p className="text-sm text-slate-600">{tutorial.description}</p>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Suggested Length: {tutorial.duration}
              </p>

              {embedUrl ? (
                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                  <iframe
                    title={tutorial.title}
                    src={embedUrl}
                    className="h-64 w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  Video placeholder. Add a YouTube or Vimeo URL for this tutorial to publish it.
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}