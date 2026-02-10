import { SidebarLayout } from "@/components/SidebarLayout";

const adminNav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/properties", label: "Properties" },
  { href: "/admin/tenancies", label: "Tenancies" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/applicants", label: "Applicants" },
  { href: "/admin/offers", label: "Offers" },
  { href: "/admin/landlords", label: "Landlords" },
  { href: "/admin/tenants", label: "Tenants" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <SidebarLayout title="Admin CRM" navItems={adminNav}>
      {children}
    </SidebarLayout>
  );
}
