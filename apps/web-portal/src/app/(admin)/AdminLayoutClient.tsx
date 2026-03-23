"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SidebarLayout } from "@/components/SidebarLayout";
import { AdminSignOut } from "@/components/AdminSignOut";
import { AdminAgencySwitcher } from "@/components/admin/AdminAgencySwitcher";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

const adminNavBase = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/properties", label: "Properties" },
  { href: "/admin/tenancies", label: "Tenancies" },
  { href: "/admin/rent", label: "Rent" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/contractors", label: "Contractors" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/maintenance", label: "Maintenance" },
  { href: "/admin/enquiries", label: "Enquiries" },
  { href: "/admin/applicants", label: "Applicants" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/application-pipeline", label: "Application pipeline" },
  { href: "/admin/viewings", label: "Viewings" },
  { href: "/admin/offers", label: "Offers" },
  { href: "/admin/tenants", label: "Tenants" },
  { href: "/admin/landlords", label: "Landlords" },
  { href: "/admin/profile", label: "Profile" },
  { href: "/admin/settings", label: "Settings" },
];

function withAgencyId(href: string, agencyId: string | null): string {
  if (!agencyId) return href;
  const [path, qs = ""] = href.split("?");
  const params = new URLSearchParams(qs);
  params.set("agencyId", agencyId);
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

export function AdminLayoutClient({
  children,
}: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, signOut } = useAuth();
  const agencyIdParam = searchParams?.get("agencyId")?.trim() || null;

  // IMPORTANT:
  // Admin pages must use effectiveAgencyId (superAdmin = URL param, admin = session).
  // This layout preserves `?agencyId=` in sidebar links for superAdmin.
  const adminNavSections = useMemo(() => {
    const landlordInvitesItem = { href: "/admin/landlord-invites", label: "Landlord Invites" };
    const base = adminNavBase.slice();

    const oversightExtras =
      profile?.role === "superAdmin"
        ? [{ href: "/admin/users", label: "Users" }, landlordInvitesItem]
        : profile?.role === "admin"
          ? [landlordInvitesItem]
          : [];

    const sections = [
      {
        title: "Oversight",
        items: [
          base.find((i) => i.href === "/admin")!,
          { href: "/admin/staff-action-queue", label: "Staff action queue" },
          { href: "/admin/landlords", label: "Landlords" },
          ...oversightExtras,
          { href: "/admin/profile", label: "Profile" },
          { href: "/admin/settings", label: "Settings" },
        ].filter(Boolean),
      },
      {
        title: "Pipeline",
        items: [
          { href: "/admin/enquiries", label: "Enquiries" },
          { href: "/admin/applicants", label: "Applicants" },
          { href: "/admin/applications", label: "Applications" },
          { href: "/admin/viewings", label: "Viewings" },
          { href: "/admin/offers", label: "Offers" },
          { href: "/admin/application-pipeline", label: "Application pipeline" },
        ],
      },
      {
        title: "Tenancy management",
        items: [
          { href: "/admin/tenancies", label: "Tenancies" },
          { href: "/admin/rent", label: "Rent" },
          { href: "/admin/tenants", label: "Tenants" },
        ],
      },
      {
        title: "Property operations",
        items: [{ href: "/admin/properties", label: "Properties" }],
      },
      {
        title: "Maintenance",
        items: [
          { href: "/admin/tickets", label: "Tickets" },
          { href: "/admin/maintenance", label: "Maintenance requests" },
          { href: "/admin/jobs", label: "Jobs" },
          { href: "/admin/contractors", label: "Contractors" },
        ],
      },
    ];

    const mapped = sections.map((s) => ({
      ...s,
      items: s.items.map((i) => ({
        ...i,
        href: profile?.role === "superAdmin" ? withAgencyId(i.href, agencyIdParam) : i.href,
      })),
    }));

    return mapped;
  }, [profile?.role, agencyIdParam]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (profile && profile.status === "disabled") {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-100 p-6">
        <PageHeader title="Admin" />
        <Card className="p-6 max-w-md">
          <p className="text-zinc-800 mb-4">Account disabled.</p>
          <button
            type="button"
            onClick={() => signOut().then(() => router.replace("/sign-in"))}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Sign out
          </button>
        </Card>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <SidebarLayout
        title="Admin CRM"
        navItems={adminNavBase}
        navSections={adminNavSections}
        footerContent={<AdminSignOut />}
        headerAction={profile?.role === "superAdmin" ? <AdminAgencySwitcher /> : undefined}
      >
        {children}
      </SidebarLayout>
    </ThemeProvider>
  );
}
