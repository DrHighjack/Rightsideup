interface TutorialVideo {
  id: string;
  title: string;
  description: string;
  duration: string;
  embedUrl?: string;
}

const tutorialVideos: TutorialVideo[] = [
  {
    id: "create-order",
    title: "Create A New Order",
    description: "Walkthrough of creating an order and assigning key details.",
    duration: "4:32",
    embedUrl: "",
  },
  {
    id: "manage-clients",
    title: "Manage Clients",
    description: "How to update client details, assign closers, and adjust payment method.",
    duration: "5:10",
    embedUrl: "",
  },
  {
    id: "track-811",
    title: "Work 811 Tickets",
    description: "How to review, clear, and manage 811 tickets from the admin panel.",
    duration: "6:05",
    embedUrl: "",
  },
];

export default function AdminTutorialsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Tutorials</h1>
        <p className="text-gray-600 mt-1">
          Video walkthroughs for the core workflows in the app.
        </p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-900">
          Add your video links by updating the tutorial list in this page. Use embeddable links from YouTube, Vimeo, or Loom.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {tutorialVideos.map((video) => (
          <article key={video.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {video.embedUrl ? (
              <div className="aspect-video bg-black">
                <iframe
                  title={video.title}
                  src={video.embedUrl}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="aspect-video bg-gray-100 flex items-center justify-center">
                <div className="text-center px-6">
                  <p className="text-sm font-semibold text-gray-700">Video Coming Soon</p>
                  <p className="text-xs text-gray-500 mt-1">Paste an embed URL to display this tutorial here.</p>
                </div>
              </div>
            )}

            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg font-semibold text-gray-900">{video.title}</h2>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  {video.duration}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600">{video.description}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
