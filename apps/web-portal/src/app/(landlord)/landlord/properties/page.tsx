import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { mockListings } from "@/lib/data/mock";

export default function LandlordPropertiesPage() {
  return (
    <>
      <PageHeader title="Properties" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockListings.map((listing) => (
          <Link key={listing.id} href={`/landlord/properties/${listing.id}`}>
            <Card className="h-full hover:border-zinc-400 transition-colors">
              <p className="font-medium text-zinc-900">{listing.title}</p>
              <p className="text-sm text-zinc-600 mt-1">{listing.addressSummary}</p>
              <p className="text-sm text-zinc-500 mt-1">{listing.status}</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
