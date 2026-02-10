import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function AdminApplicantsPage() {
  return (
    <>
      <PageHeader title="Applicants" />
      <EmptyState
        title="Applicants list"
        description="Application records will appear here."
      />
    </>
  );
}
