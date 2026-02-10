import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Card } from "@/components/Card";
import { mockListings } from "@/lib/data/mock";

type Props = { params: Promise<{ id: string }> };

export default async function ListingDetailPage({ params }: Props) {
  const { id } = await params;
  const listing = mockListings.find((l) => l.id === id);
  if (!listing) notFound();

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <SiteHeader />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        <Link href="/listings" className="text-sm text-zinc-600 hover:underline mb-4 inline-block">
          ← Back to listings
        </Link>
        <Card className="p-6">
          <h1 className="text-2xl font-semibold text-zinc-900">{listing.title}</h1>
          <p className="text-zinc-600 mt-1">{listing.addressSummary}</p>
          <p className="text-zinc-500 text-sm mt-2">
            {listing.beds} bed · {listing.baths} bath · {listing.status}
          </p>
          <p className="mt-4 text-xl font-semibold text-zinc-900">
            £{listing.price.toLocaleString()}/month
          </p>
          <p className="mt-4 text-sm text-zinc-500">
            Contact the agency for viewings and applications.
          </p>
        </Card>
      </main>
    </div>
  );
}
