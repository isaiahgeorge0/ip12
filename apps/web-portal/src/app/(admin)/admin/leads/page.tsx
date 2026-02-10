import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function AdminLeadsPage() {
  return (
    <>
      <PageHeader title="Leads" />
      <EmptyState
        title="Leads list"
        description="Enquiry and lead records will appear here."
      />
    </>
  );
}
