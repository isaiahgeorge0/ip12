import { redirect } from "next/navigation";
import { requireServerSession, assertRole } from "@/lib/auth/authz";
import { getDefaultDestinationForRole } from "@/lib/auth/roleDestination";
import { PortalLayoutClient } from "./PortalLayoutClient";

export default async function PortalLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await requireServerSession("/sign-in?returnTo=/portal");

  if (session.status === "disabled") {
    redirect("/auth/disabled");
  }

  assertRole(session, ["public", "lead"], getDefaultDestinationForRole(session.role));

  return <PortalLayoutClient>{children}</PortalLayoutClient>;
}
