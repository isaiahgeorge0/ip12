"use client";

import { PageHeader } from "@/components/PageHeader";
import { AdminSectionHeader } from "@/components/admin/AdminSectionHeader";
import { SuperAdminGlobalSearch } from "@/components/superadmin/SuperAdminGlobalSearch";
import { SuperAdminDashboardOverview } from "@/components/superadmin/SuperAdminDashboardOverview";

export default function SuperAdminPage() {
  return (
    <>
      <PageHeader
        title="SuperAdmin control panel"
        subtitle="Cross-agency oversight, approvals, and platform operations."
      />
      <AdminSectionHeader title="Global search" />
      <p className="text-sm text-zinc-500 mb-3">
        Search across agencies, properties, and users to jump to the right context.
      </p>
      <SuperAdminGlobalSearch />
      <SuperAdminDashboardOverview />
    </>
  );
}
