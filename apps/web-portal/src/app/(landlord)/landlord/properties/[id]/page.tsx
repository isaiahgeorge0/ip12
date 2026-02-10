import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { mockListings } from "@/lib/data/mock";

type Props = { params: Promise<{ id: string }> };

export default async function LandlordPropertyDetailPage({ params }: Props) {
  const { id } = await params;
  const listing = mockListings.find((l) => l.id === id);
  if (!listing) notFound();

  return (
    <>
      <PageHeader
        title={listing.title}
        action={
          <Link
            href="/landlord/properties"
            className="text-sm text-zinc-600 hover:underline"
          >
            ← Back to properties
          </Link>
        }
      />
      <Card className="p-6">
        <p className="text-zinc-600">{listing.addressSummary}</p>
        <p className="text-zinc-500 text-sm mt-2">
          {listing.beds} bed · {listing.baths} bath · {listing.status}
        </p>
        <p className="mt-2 font-medium text-zinc-900">
          £{listing.price.toLocaleString()}/month
        </p>
      </Card>
    </>
  );
}
