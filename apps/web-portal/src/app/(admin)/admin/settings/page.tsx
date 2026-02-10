import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export default function AdminSettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <EmptyState
        title="Settings"
        description="Agency and app settings will be configured here."
      />
    </>
  );
}
