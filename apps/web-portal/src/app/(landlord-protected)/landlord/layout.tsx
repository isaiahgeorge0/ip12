import { redirect } from "next/navigation";
import { requireServerSession, assertRole } from "@/lib/auth/authz";
import { getDefaultDestinationForRole } from "@/lib/auth/roleDestination";
import { LandlordLayoutClient } from "./LandlordLayoutClient";

export default async function LandlordLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await requireServerSession("/landlord/sign-in");

  if (session.status === "disabled") {
    if (process.env.NODE_ENV !== "production") {
      console.info("[Role Debug] landlord layout: status disabled -> redirect to disabled");
    }
    redirect("/auth/disabled");
  }

  assertRole(session, ["landlord", "superAdmin"], getDefaultDestinationForRole(session.role));

  return <LandlordLayoutClient>{children}</LandlordLayoutClient>;
}
