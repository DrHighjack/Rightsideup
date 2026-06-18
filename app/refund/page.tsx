import Link from "next/link";

type Section = {
  id: string;
  title: string;
  paragraphs: string[];
};

const sections: Section[] = [
  {
    id: "cancellation-and-refunds",
    title: "Cancellation & Refunds",
    paragraphs: [
      "Orders canceled before production, dispatch, or scheduled field work may be eligible for a full or partial refund, less applicable processing and third-party costs already incurred.",
      "Orders canceled after production has started, after dispatch, or after installation has been performed are typically non-refundable except where required by law.",
      "If a job cannot proceed due to inaccessible site conditions, safety restrictions, missing authorization, or customer-provided address errors, a rescheduling or dispatch fee may apply.",
      "Approved refunds are returned to the original payment method when possible and may require normal banking settlement timeframes.",
    ],
  },
  {
    id: "payment-terms",
    title: "Payment Terms",
    paragraphs: [
      "Payment is due at checkout unless your account has written invoice terms. By submitting your order, you authorize North Shore Sign Co to charge applicable service fees, add-ons, and approved adjustments.",
      "Past due balances may incur late fees and may result in temporary suspension of new service requests until the account is current.",
      "Charge disputes should be reported to us first so we can investigate and resolve billing issues promptly.",
    ],
  },
  {
    id: "late-fees-and-collections",
    title: "Late Fees & Collections",
    paragraphs: [
      "If invoices remain unpaid beyond their due date, we may assess reasonable late fees as permitted by law.",
      "Accounts sent to collections may be subject to additional recovery costs, including collection and legal fees where permitted.",
    ],
  },
  {
    id: "how-to-request-refund",
    title: "How to Request a Refund Review",
    paragraphs: [
      "Send refund requests to billing@northshoresignco.com with your order number, service address, and reason for request.",
      "Our team reviews requests in good faith and responds with status, required details, and next steps.",
    ],
  },
];

export default function RefundPage() {
  return (
    <main className="min-h-screen bg-white px-4 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 border-b border-gray-200 pb-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold tracking-wide text-gray-700">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
            North Shore Sign Co
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Refund &amp; Cancellation Policy</h1>
          <p className="mt-2 text-sm text-gray-600">Last Updated: June 2026</p>
        </header>

        <section className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-5">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Table of Contents</h2>
          <ul className="grid gap-2 text-sm text-blue-700 md:grid-cols-2">
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="hover:underline">
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-8">
          {sections.map((section) => (
            <article key={section.id} id={section.id} className="scroll-mt-24 border-t border-gray-200 pt-6">
              <h3 className="text-xl font-semibold text-gray-900">{section.title}</h3>
              <div className="mt-3 space-y-3 text-[15px] leading-7 text-gray-700">
                {section.paragraphs.map((paragraph, index) => (
                  <p key={`${section.id}-${index}`}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </section>

        <div className="mt-10 border-t border-gray-200 pt-6">
          <Link href="/" className="text-sm font-medium text-blue-700 hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
