import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function AdminLandlordsPage() {
  return (
    <>
      <PageHeader title="Landlords" />
      <EmptyState
        title="Landlords list"
        description="Landlord records will appear here."
      />
    </>
  );
}
