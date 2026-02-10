import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";

export default function LandlordOverviewPage() {
  return (
    <>
      <PageHeader title="Overview" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/landlord/properties">
          <Card className="h-full hover:border-zinc-400 transition-colors">
            <p className="font-medium text-zinc-900">Properties</p>
            <p className="text-sm text-zinc-500 mt-1">View your properties</p>
          </Card>
        </Link>
        <Link href="/landlord/maintenance">
          <Card className="h-full hover:border-zinc-400 transition-colors">
            <p className="font-medium text-zinc-900">Maintenance</p>
            <p className="text-sm text-zinc-500 mt-1">Issues and requests</p>
          </Card>
        </Link>
        <Link href="/landlord/offers">
          <Card className="h-full hover:border-zinc-400 transition-colors">
            <p className="font-medium text-zinc-900">Offers</p>
            <p className="text-sm text-zinc-500 mt-1">Tenancy offers</p>
          </Card>
        </Link>
      </div>
    </>
  );
}
