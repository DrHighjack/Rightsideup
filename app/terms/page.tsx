import Link from "next/link";

type Section = {
  id: string;
  title: string;
  paragraphs: string[];
};

const sections: Section[] = [
  {
    id: "811-dig-law-compliance",
    title: "811 Dig Law Compliance",
    paragraphs: [
      "North Shore Sign Co follows all Washington State 811 and utility mark-out requirements before qualifying installation work. Customers are responsible for providing accurate site details and notifying us of private utility systems not covered by public locate services.",
      "If a job requires additional locate coordination, service dates may adjust to maintain legal compliance and job-site safety.",
    ],
  },
  {
    id: "installation-process",
    title: "Installation Process",
    paragraphs: [
      "Installation scheduling windows are estimates and may vary based on route sequencing, workload, weather, and site readiness.",
      "A completed order is considered fulfilled when installation has been performed at the approved address and documented in our system.",
    ],
  },
  {
    id: "theft-damage-replacement",
    title: "Theft & Damage Replacement",
    paragraphs: [
      "Customer is responsible for signs after placement unless otherwise required by law. Lost, stolen, vandalized, or weather-damaged signs may require replacement fees.",
      "Replacement requests are handled as new work orders and billed under current pricing unless covered by an active written agreement.",
    ],
  },
  {
    id: "cancellation-refunds",
    title: "Cancellation & Refunds",
    paragraphs: [
      "Orders cancelled before production or dispatch may qualify for partial or full refund after administrative review. Once production, route assignment, or installation labor begins, refundable amounts may be reduced or unavailable.",
      "Approved refunds are returned to the original payment method when possible.",
    ],
  },
  {
    id: "payment-terms-late-fees",
    title: "Payment Terms & Late Fees",
    paragraphs: [
      "Payment is due according to invoice terms. Past-due balances may incur late fees, collection costs, and service hold or suspension.",
      "By placing an order, customer authorizes North Shore Sign Co to charge approved payment methods for completed services and valid add-on charges.",
    ],
  },
  {
    id: "liability",
    title: "Liability",
    paragraphs: [
      "North Shore Sign Co is not liable for indirect, incidental, or consequential damages, including lost opportunity, lost commissions, or market timing impacts.",
      "Maximum liability, when permitted by law, is limited to the amount paid for the specific service giving rise to the claim.",
    ],
  },
  {
    id: "property-damage-disclaimer",
    title: "Property Damage Disclaimer",
    paragraphs: [
      "Customer must disclose underground systems, irrigation, invisible fencing, decorative lighting, and private lines prior to service.",
      "North Shore Sign Co is not responsible for damage caused by unknown, unmarked, or inaccurately disclosed private utilities or hidden site conditions.",
    ],
  },
  {
    id: "weather-acts-of-god",
    title: "Weather & Acts of God",
    paragraphs: [
      "Service delays caused by severe weather, natural disasters, wildfire smoke, utility emergencies, or government restrictions do not constitute breach of contract.",
      "Schedules may be rescheduled without penalty when safety or compliance conditions require it.",
    ],
  },
  {
    id: "access-site-conditions",
    title: "Access & Site Conditions",
    paragraphs: [
      "Customer is responsible for providing safe and lawful access to installation areas, including gate codes, parking instructions, and hazard disclosures.",
      "If a site is inaccessible or unsafe on arrival, a trip or rescheduling fee may apply.",
    ],
  },
  {
    id: "change-orders",
    title: "Change Orders",
    paragraphs: [
      "Address changes, installation location changes, rush requests, material substitutions, and non-standard requests may require written change approval and price adjustment.",
      "Work may pause until change terms are accepted.",
    ],
  },
  {
    id: "sign-compliance",
    title: "Sign Compliance",
    paragraphs: [
      "Customer is responsible for listing-agent authorization, HOA restrictions, municipal sign rules, and brokerage compliance requirements.",
      "North Shore Sign Co may decline placement that appears non-compliant or unsafe.",
    ],
  },
  {
    id: "design-materials",
    title: "Design & Materials",
    paragraphs: [
      "Colors, finishes, and material availability may vary. Equivalent substitutions may be used when supply constraints occur.",
      "Customer-provided artwork and brand assets must be lawful and properly licensed.",
    ],
  },
  {
    id: "indemnification",
    title: "Indemnification",
    paragraphs: [
      "Customer agrees to defend and indemnify North Shore Sign Co from third-party claims arising from inaccurate instructions, unauthorized placement, or customer-provided content.",
      "This includes reasonable legal costs to the extent permitted by law.",
    ],
  },
  {
    id: "insurance",
    title: "Insurance",
    paragraphs: [
      "North Shore Sign Co maintains commercially reasonable insurance coverage for operations. Proof of insurance may be provided upon written request where appropriate.",
    ],
  },
  {
    id: "photo-rights",
    title: "Photo Rights",
    paragraphs: [
      "North Shore Sign Co may photograph installed work for quality control, support, training, and portfolio use, excluding confidential customer data.",
    ],
  },
  {
    id: "agent-authority",
    title: "Agent Authority",
    paragraphs: [
      "By placing an order, the customer represents they have authority to request services for the property and accept associated charges and terms.",
    ],
  },
  {
    id: "right-to-modify-service",
    title: "Right to Modify Service",
    paragraphs: [
      "North Shore Sign Co may update service procedures, pricing models, or policy language. Material changes are effective when posted or otherwise communicated.",
    ],
  },
  {
    id: "dispute-resolution",
    title: "Dispute Resolution",
    paragraphs: [
      "Parties agree to attempt good-faith resolution before formal proceedings. Venue and governing law are based on Washington State unless otherwise required by law.",
    ],
  },
  {
    id: "service-area",
    title: "Service Area",
    paragraphs: [
      "North Shore Sign Co primarily serves designated Washington service zones. Jobs outside normal routes may incur travel or scheduling surcharges.",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white px-4 py-10 text-gray-900">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 border-b border-gray-200 pb-6">
          <p className="text-sm font-semibold tracking-wide text-gray-600">North Shore Sign Co</p>
          <h1 className="mt-2 text-3xl font-bold">Terms & Conditions</h1>
          <p className="mt-2 text-sm text-gray-600">Last Updated: June 2026</p>
        </header>

        <section className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-5">
          <h2 className="text-lg font-semibold">Table of Contents</h2>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {sections.map((section) => (
              <li key={section.id}>
                <a className="text-blue-700 hover:underline" href={`#${section.id}`}>
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6 leading-7">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 border-t border-gray-200 pt-6">
              <h2 className="text-2xl font-semibold">{section.title}</h2>
              <div className="mt-3 space-y-3 text-base text-gray-700">
                {section.paragraphs.map((paragraph, index) => (
                  <p key={`${section.id}-${index}`}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 border-t border-gray-200 pt-6">
          <Link href="/" className="text-blue-700 hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
