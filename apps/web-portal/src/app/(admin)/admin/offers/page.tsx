import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function AdminOffersPage() {
  return (
    <>
      <PageHeader title="Offers" />
      <EmptyState
        title="Offers list"
        description="Tenancy offers will be managed here."
      />
    </>
  );
}
