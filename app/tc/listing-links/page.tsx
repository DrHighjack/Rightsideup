import { ListingLinkRequests } from "@/app/components/ListingLinkRequests";
import Link from "next/link";

export default function TcListingLinksPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 pb-24 sm:p-8">
      <ListingLinkRequests />
      <nav className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-8 px-6 py-4">
          <Link href="/tc/dashboard" className="font-medium text-gray-700 hover:text-indigo-600">Dashboard</Link>
          <Link href="/tc/pricing" className="font-medium text-gray-700 hover:text-indigo-600">Pricing</Link>
          <Link href="/tc/listing-links" className="border-b-2 border-indigo-600 pb-1 font-medium text-indigo-600">Listing Links</Link>
        </div>
      </nav>
    </main>
  );
}