"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { SidebarLayout } from "@/components/SidebarLayout";
import { AdminSignOut } from "@/components/AdminSignOut";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";

const adminNavBase = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/properties", label: "Properties" },
  { href: "/admin/tenancies", label: "Tenancies" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/applicants", label: "Applicants" },
  { href: "/admin/offers", label: "Offers" },
  { href: "/admin/tenants", label: "Tenants" },
  { href: "/admin/landlords", label: "Landlords" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/profile", label: "Profile" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminLayoutClient({
  children,
}: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();

  const adminNav = useMemo(() => {
    const landlordInvitesItem = { href: "/admin/landlord-invites", label: "Landlord Invites" };
    if (profile?.role === "superAdmin") {
      const usersItem = { href: "/admin/users", label: "Users" };
      return [...adminNavBase.slice(0, -1), usersItem, landlordInvitesItem, adminNavBase[adminNavBase.length - 1]];
    }
    if (profile?.role === "admin") {
      const idx = adminNavBase.findIndex((i) => i.href === "/admin/settings");
      if (idx > 0) {
        return [...adminNavBase.slice(0, idx), landlordInvitesItem, ...adminNavBase.slice(idx)];
      }
      return [...adminNavBase, landlordInvitesItem];
    }
    return adminNavBase;
  }, [profile?.role]);

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

  if (profile && profile.status !== "active") {
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
    <SidebarLayout
      title="Admin CRM"
      navItems={adminNav}
      footerContent={<AdminSignOut />}
    >
      {children}
    </SidebarLayout>
  );
}
