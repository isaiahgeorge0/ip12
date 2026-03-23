import { redirect } from "next/navigation";
import { requireServerSession, assertRole } from "@/lib/auth/authz";
import { getDefaultDestinationForRole } from "@/lib/auth/roleDestination";
import { AdminLayoutClient } from "./AdminLayoutClient";

export default async function AdminLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await requireServerSession("/auth/sign-in");

  if (session.status === "disabled") {
    if (process.env.NODE_ENV !== "production") {
      console.info("[Role Debug] admin layout: status disabled -> redirect to disabled");
    }
    redirect("/auth/disabled");
  }

  assertRole(session, ["superAdmin", "admin", "agent"], getDefaultDestinationForRole(session.role));

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
