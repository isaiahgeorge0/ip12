import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";

const links = [
  { href: "/admin/properties", label: "Properties" },
  { href: "/admin/tenancies", label: "Tenancies" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/applicants", label: "Applicants" },
  { href: "/admin/landlords", label: "Landlords" },
  { href: "/admin/tenants", label: "Tenants" },
];

export default function AdminDashboardPage() {
  return (
    <>
      <PageHeader title="Admin dashboard" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full hover:border-zinc-400 transition-colors">
              <p className="font-medium text-zinc-900">{item.label}</p>
              <p className="text-sm text-zinc-500 mt-1">View and manage</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
