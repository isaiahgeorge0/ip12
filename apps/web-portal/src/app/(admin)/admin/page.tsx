import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { AdminDashboardOverview } from "@/components/admin/AdminDashboardOverview";
import { AdminSectionHeader } from "@/components/admin/AdminSectionHeader";

const moduleLinks = [
  { href: "/admin/properties", label: "Properties" },
  { href: "/admin/applicants", label: "Applicants" },
  { href: "/admin/viewings", label: "Viewings" },
  { href: "/admin/application-pipeline", label: "Application pipeline" },
  { href: "/admin/offers", label: "Offers" },
  { href: "/admin/staff-action-queue", label: "Action queue" },
  { href: "/admin/tenancies", label: "Tenancies" },
  { href: "/admin/tenants", label: "Tenants" },
  { href: "/admin/landlords", label: "Landlords" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/contractors", label: "Contractors" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/enquiries", label: "Enquiries" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/profile", label: "Profile" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminDashboardPage() {
  return (
    <>
      <PageHeader
        title="Admin dashboard"
        subtitle="Operational control centre for your agency."
      />
      <AdminDashboardOverview />
      <AdminSectionHeader title="Modules" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {moduleLinks.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full hover:border-zinc-300 transition-colors">
              <p className="text-sm font-medium text-zinc-900">{item.label}</p>
              <p className="text-xs text-zinc-500 mt-1">View and manage</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
