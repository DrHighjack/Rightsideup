import Link from "next/link";

type Section = {
  id: string;
  title: string;
  paragraphs: string[];
};

const sections: Section[] = [
  {
    id: "information-we-collect",
    title: "Information We Collect",
    paragraphs: [
      "We collect account details, contact information, order information, billing metadata, and service activity required to operate SignPost Field.",
      "We also collect technical usage data such as device type, IP address, browser details, and interaction events to maintain platform reliability and security.",
    ],
  },
  {
    id: "how-we-use-information",
    title: "How We Use Information",
    paragraphs: [
      "Information is used to provide services, process orders, coordinate scheduling, send notifications, improve features, and meet legal or compliance obligations.",
      "We may also use data for fraud prevention, account security, and support issue resolution.",
    ],
  },
  {
    id: "instagram-api",
    title: "Instagram API Data Use",
    paragraphs: [
      "If connected, Instagram-related data is processed only for authorized account workflows, lead capture, and campaign operations requested by the account owner.",
      "We do not sell Instagram API data. Access scopes are limited to required platform features and can be revoked by disconnecting integrations.",
    ],
  },
  {
    id: "upsigndown-services",
    title: "UpSignDown and Related Services",
    paragraphs: [
      "Where integrated with UpSignDown or similar workflow tooling, data is exchanged solely for service delivery functions, operational synchronization, and user-requested actions.",
      "Third-party platform privacy practices apply in addition to this policy.",
    ],
  },
  {
    id: "cookies-tracking",
    title: "Cookies and Tracking Technologies",
    paragraphs: [
      "We use essential cookies and session technologies for authentication, security, and user experience continuity.",
      "Optional analytics technologies may be used to measure performance and improve usability. You can manage browser cookie settings at any time.",
    ],
  },
  {
    id: "data-sharing",
    title: "Data Sharing",
    paragraphs: [
      "We share limited data with service providers such as hosting, email, payment, and infrastructure partners only as needed to operate SignPost Field.",
      "We may disclose data when legally required, to enforce rights, or to prevent fraud and abuse.",
    ],
  },
  {
    id: "data-security",
    title: "Data Security",
    paragraphs: [
      "We apply commercially reasonable safeguards including encryption in transit, access controls, monitoring, and operational security practices.",
      "No method of storage or transmission is guaranteed to be completely secure, but we continuously improve our safeguards.",
    ],
  },
  {
    id: "data-retention",
    title: "Data Retention",
    paragraphs: [
      "We retain personal data for as long as needed for service delivery, legal compliance, dispute resolution, and legitimate business purposes.",
      "Retention periods vary by data category, account status, and legal obligations.",
    ],
  },
  {
    id: "privacy-rights",
    title: "Your Privacy Rights",
    paragraphs: [
      "Depending on your location, you may have rights to request access, correction, deletion, portability, or restriction of certain personal data.",
      "To submit a privacy request, contact billing@northshoresignco.com. We may verify identity before fulfilling requests.",
    ],
  },
  {
    id: "children",
    title: "Children's Privacy",
    paragraphs: [
      "SignPost Field is not directed to children under 13, and we do not knowingly collect personal data from children under 13.",
    ],
  },
  {
    id: "policy-updates",
    title: "Policy Updates",
    paragraphs: [
      "We may update this policy from time to time. Material changes become effective when posted with a revised Last Updated date.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    paragraphs: [
      "North Shore Sign Co",
      "6189 NE Radford Dr Apt 1911, Seattle WA 98115",
      "Phone: (206) 659-6323",
      "Email: billing@northshoresignco.com",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white px-4 py-10 text-gray-900">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 border-b border-gray-200 pb-6">
          <p className="text-sm font-semibold tracking-wide text-gray-600">North Shore Sign Co</p>
          <h1 className="mt-2 text-3xl font-bold">Privacy Policy</h1>
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
