import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Card } from "@/components/Card";
import { mockListings } from "@/lib/data/mock";

export default function ListingsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <SiteHeader />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-zinc-900 mb-6">
          Property listings
        </h1>
        <div className="mb-6 flex flex-wrap gap-3 rounded-lg border border-zinc-200 bg-white p-4">
          <span className="text-sm text-zinc-500">Filters (placeholder):</span>
          <button type="button" className="rounded border border-zinc-300 px-3 py-1.5 text-sm">
            Location
          </button>
          <button type="button" className="rounded border border-zinc-300 px-3 py-1.5 text-sm">
            Beds
          </button>
          <button type="button" className="rounded border border-zinc-300 px-3 py-1.5 text-sm">
            Price
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mockListings.map((listing) => (
            <Link key={listing.id} href={`/listings/${listing.id}`}>
              <Card className="h-full hover:border-zinc-400 transition-colors">
                <p className="font-medium text-zinc-900">{listing.title}</p>
                <p className="text-sm text-zinc-600 mt-1">{listing.addressSummary}</p>
                <p className="text-sm text-zinc-500 mt-1">
                  {listing.beds} bed · {listing.baths} bath
                </p>
                <p className="mt-2 font-medium text-zinc-900">
                  £{listing.price.toLocaleString()}/month
                </p>
                <span className="inline-block mt-2 text-xs text-zinc-500">
                  {listing.status}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
