import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/serverSession";
import { AdminLayoutClient } from "./AdminLayoutClient";

const ADMIN_ALLOWED_ROLES = ["superAdmin", "admin", "agent"] as const;

export default async function AdminLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await getServerSession();

  if (!session) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[Role Debug] admin layout: no session -> redirect to sign-in");
    }
    redirect("/auth/sign-in");
  }

  if (session.status !== "active") {
    if (process.env.NODE_ENV !== "production") {
      console.info("[Role Debug] admin layout: status not active -> redirect to disabled");
    }
    redirect("/auth/disabled");
  }

  if (!ADMIN_ALLOWED_ROLES.includes(session.role as (typeof ADMIN_ALLOWED_ROLES)[number])) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[Role Debug] admin layout: role", session.role, "-> redirect to landlord");
    }
    redirect("/landlord");
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
