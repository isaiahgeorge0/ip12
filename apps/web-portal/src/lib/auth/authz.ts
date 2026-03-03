/**
 * Server-only authz helpers: require session, assert role, assert landlord access.
 */

import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/serverSession";
import { canAdminViewLandlord } from "@/lib/landlordGrants";
import type { ServerSessionProfile } from "@/lib/auth/serverSession";

type Firestore = Awaited<ReturnType<typeof import("@/lib/firebase/admin").getAdminFirestore>>;

/** Returns session or redirects to redirectTo. */
export async function requireServerSession(redirectTo: string): Promise<ServerSessionProfile> {
  const session = await getServerSession();
  if (!session) redirect(redirectTo);
  return session;
}

/** Redirects to redirectTo (default /admin) if session.role is not in allowedRoles. */
export function assertRole(
  session: ServerSessionProfile,
  allowedRoles: string[],
  redirectTo = "/admin"
): void {
  if (!allowedRoles.includes(session.role)) redirect(redirectTo);
}

/** Calls canAdminViewLandlord; returns { ok: true } or { ok: false, reason }. Caller decides UI. */
export async function assertCanAdminViewLandlord(
  db: Firestore,
  session: ServerSessionProfile,
  landlordUid: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const result = await canAdminViewLandlord(db, session, landlordUid);
  if (result.ok) return { ok: true };
  return { ok: false, reason: result.reason ?? "No access" };
}
