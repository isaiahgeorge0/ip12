import { redirect } from "next/navigation";
import { requireServerSession, assertRole } from "@/lib/auth/authz";
import { LandlordLayoutClient } from "./LandlordLayoutClient";

export default async function LandlordLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await requireServerSession("/landlord/sign-in");

  if (session.status !== "active") {
    if (process.env.NODE_ENV !== "production") {
      console.info("[Role Debug] landlord layout: status not active -> redirect to disabled");
    }
    redirect("/auth/disabled");
  }

  assertRole(session, ["landlord", "superAdmin"], "/admin");

  return <LandlordLayoutClient>{children}</LandlordLayoutClient>;
}
