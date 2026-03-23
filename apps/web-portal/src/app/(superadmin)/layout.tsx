import { redirect } from "next/navigation";
import { requireServerSession, assertSuperAdmin } from "@/lib/auth/authz";
import { SuperAdminShell } from "@/components/superadmin/SuperAdminShell";

export default async function SuperAdminLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await requireServerSession("/auth/sign-in");

  if (session.status === "disabled") {
    redirect("/auth/disabled");
  }

  assertSuperAdmin(session, "/admin");

  return <SuperAdminShell>{children}</SuperAdminShell>;
}
