import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function AdminPropertiesPage() {
  return (
    <>
      <PageHeader title="Properties" />
      <EmptyState
        title="Properties list"
        description="Property records will be loaded from the backend here."
      />
    </>
  );
}
