import { SidebarLayout } from "@/components/SidebarLayout";

const landlordNav = [
  { href: "/landlord", label: "Overview" },
  { href: "/landlord/properties", label: "Properties" },
  { href: "/landlord/applicants", label: "Applicants" },
  { href: "/landlord/offers", label: "Offers" },
  { href: "/landlord/maintenance", label: "Maintenance" },
];

export default function LandlordLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <SidebarLayout title="Landlord Portal" navItems={landlordNav}>
      {children}
    </SidebarLayout>
  );
}
