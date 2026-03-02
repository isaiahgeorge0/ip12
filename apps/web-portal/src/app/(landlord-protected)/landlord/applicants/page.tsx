import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function LandlordApplicantsPage() {
  return (
    <>
      <PageHeader title="Applicants" />
      <EmptyState
        title="Applicants"
        description="Applicants for your properties will appear here."
      />
    </>
  );
}
