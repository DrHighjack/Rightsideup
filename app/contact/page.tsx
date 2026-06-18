import Link from "next/link";

const businessHours = [
  { label: "Monday-Friday", value: "8:00 AM - 6:00 PM" },
  { label: "Saturday", value: "9:00 AM - 4:00 PM" },
  { label: "Sunday", value: "Closed" },
];

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-white px-4 py-10 text-gray-900">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 border-b border-gray-200 pb-6">
          <p className="text-sm font-semibold tracking-wide text-gray-600">North Shore Sign Co</p>
          <h1 className="mt-2 text-3xl font-bold">Contact Us</h1>
          <p className="mt-2 text-sm text-gray-600">Last Updated: June 2026</p>
        </header>

        <section className="space-y-6 rounded-lg border border-gray-200 bg-gray-50 p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">Business Information</h2>
            <p className="text-base text-gray-700">North Shore Sign Co</p>
            <p className="text-base text-gray-700">6189 NE Radford Dr Apt 1911, Seattle WA 98115</p>
            <p className="text-base text-gray-700">
              Phone: <a className="text-blue-700 hover:underline" href="tel:2066596323">(206) 659-6323</a>
            </p>
            <p className="text-base text-gray-700">
              Email:{" "}
              <a className="text-blue-700 hover:underline" href="mailto:billing@northshoresignco.com">
                billing@northshoresignco.com
              </a>
            </p>
          </div>

          <div className="border-t border-gray-200 pt-5">
            <h2 className="text-xl font-semibold text-gray-900">Business Hours</h2>
            <ul className="mt-3 space-y-2 text-base text-gray-700">
              {businessHours.map((hour) => (
                <li key={hour.label}>
                  <span className="font-medium">{hour.label}:</span> {hour.value}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-gray-200 pt-5">
            <h2 className="text-xl font-semibold text-gray-900">Service Area</h2>
            <p className="mt-2 text-base leading-7 text-gray-700">
              We serve a broad Puget Sound and surrounding corridor, from Kenmore/Bothell to the north,
              Cle Elum to the east, Puyallup to the south, and Port Orchard to the west.
            </p>
          </div>

          <div className="border-t border-gray-200 pt-5">
            <h2 className="text-xl font-semibold text-gray-900">Seattle Area Map</h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-gray-300">
              <iframe
                title="Seattle Area Map"
                src="https://www.google.com/maps?q=Seattle,+WA&output=embed"
                className="h-80 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </section>

        <div className="mt-10 border-t border-gray-200 pt-6">
          <Link href="/" className="text-blue-700 hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
