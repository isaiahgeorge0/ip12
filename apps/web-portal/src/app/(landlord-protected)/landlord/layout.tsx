import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/serverSession";
import { LandlordLayoutClient } from "./LandlordLayoutClient";

const LANDLORD_ALLOWED_ROLES = ["superAdmin", "landlord"] as const;

export default async function LandlordLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await getServerSession();

  if (!session) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[Role Debug] landlord layout: no session -> redirect to landlord sign-in");
    }
    redirect("/landlord/sign-in");
  }

  if (session.status !== "active") {
    if (process.env.NODE_ENV !== "production") {
      console.info("[Role Debug] landlord layout: status not active -> redirect to disabled");
    }
    redirect("/auth/disabled");
  }

  if (!LANDLORD_ALLOWED_ROLES.includes(session.role as (typeof LANDLORD_ALLOWED_ROLES)[number])) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[Role Debug] landlord layout: role", session.role, "-> redirect to admin");
    }
    redirect("/admin");
  }

  return <LandlordLayoutClient>{children}</LandlordLayoutClient>;
}
