import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function AdminTenanciesPage() {
  return (
    <>
      <PageHeader title="Tenancies" />
      <EmptyState
        title="Tenancies list"
        description="Active and past tenancies will appear here."
      />
    </>
  );
}
