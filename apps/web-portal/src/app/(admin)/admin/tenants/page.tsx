import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function AdminTenantsPage() {
  return (
    <>
      <PageHeader title="Tenants" />
      <EmptyState
        title="Tenants list"
        description="Tenant records will appear here."
      />
    </>
  );
}
