import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function LandlordOffersPage() {
  return (
    <>
      <PageHeader title="Offers" />
      <EmptyState
        title="Offers"
        description="Tenancy offers for your properties will appear here."
      />
    </>
  );
}
