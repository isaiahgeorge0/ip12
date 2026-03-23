/**
 * Server-only authz helpers: require session, assert role, assert landlord access.
 * Use requireServerSession/assertRole in server components (redirect).
 * Use requireServerSessionApi/assertRoleApi in API route handlers (return 401/403).
 */

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/serverSession";
import { canAdminViewLandlord } from "@/lib/landlordGrants";
import type { ServerSessionProfile } from "@/lib/auth/serverSession";

type Firestore = Awaited<ReturnType<typeof import("@/lib/firebase/admin").getAdminFirestore>>;

/** Returns session or redirects to redirectTo. Use in server components/layouts. */
export async function requireServerSession(redirectTo: string): Promise<ServerSessionProfile> {
  const session = await getServerSession();
  if (!session) redirect(redirectTo);
  return session;
}

/** Redirects to redirectTo (default /admin) if session.role is not in allowedRoles. Use in server components. */
export function assertRole(
  session: ServerSessionProfile,
  allowedRoles: string[],
  redirectTo = "/admin"
): void {
  if (!allowedRoles.includes(session.role)) redirect(redirectTo);
}

/** Returns session or 401 NextResponse. Use in API route handlers. */
export async function requireServerSessionApi(): Promise<ServerSessionProfile | NextResponse> {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 401 });
  return session;
}

/** Returns 403 NextResponse if session.role not in allowedRoles, else null. Use in API route handlers. */
export function assertRoleApi(
  session: ServerSessionProfile,
  allowedRoles: string[]
): NextResponse | null {
  if (!allowedRoles.includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

/** Redirects if session.role is not superAdmin. Use in server components (e.g. superAdmin route group). */
export function assertSuperAdmin(
  session: ServerSessionProfile,
  redirectTo = "/admin"
): void {
  assertRole(session, ["superAdmin"], redirectTo);
}

/** Returns 403 if session.role is not superAdmin, else null. Use in API route handlers. */
export function assertSuperAdminApi(session: ServerSessionProfile): NextResponse | null {
  return assertRoleApi(session, ["superAdmin"]);
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
