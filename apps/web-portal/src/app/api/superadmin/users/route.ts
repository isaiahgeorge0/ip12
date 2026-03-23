import { NextRequest, NextResponse } from "next/server";
import type { Query } from "firebase-admin/firestore";
import { requireServerSessionApi, assertSuperAdminApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import type { Role } from "@/lib/types/roles";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const STATUS_VALUES = ["active", "pending", "invited", "disabled"] as const;
const ROLES: Role[] = ["superAdmin", "admin", "agent", "landlord", "tenant", "contractor", "lead"];

type UserRow = {
  uid: string;
  email: string;
  role: string;
  status: string;
  primaryAgencyId?: string | null;
  agencyIds?: string[];
  agencyId?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function matchesAgency(
  primaryAgencyId: string | null,
  agencyIds: string[],
  legacyAgencyId: string | null,
  filterAgencyId: string
): boolean {
  if (primaryAgencyId === filterAgencyId) return true;
  if (agencyIds.includes(filterAgencyId)) return true;
  if (legacyAgencyId === filterAgencyId) return true;
  return false;
}

/**
 * GET /api/superadmin/users
 * SuperAdmin only. Query params: q (email prefix), status, role, agencyId, limit.
 * Best-effort: when q is set we query by email range then filter status/role/agencyId in memory;
 * when q is not set we query by status and role (equality) then filter agencyId in memory.
 */
export async function GET(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertSuperAdminApi(session);
  if (role403) return role403;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const statusParam = searchParams.get("status")?.trim();
  const roleParam = searchParams.get("role")?.trim();
  const agencyIdParam = searchParams.get("agencyId")?.trim() ?? null;
  const limitParam = searchParams.get("limit");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, limitParam ? parseInt(limitParam, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT)
  );

  const statusFilter =
    statusParam && STATUS_VALUES.includes(statusParam as (typeof STATUS_VALUES)[number])
      ? (statusParam as (typeof STATUS_VALUES)[number])
      : null;
  const roleFilter = roleParam && ROLES.includes(roleParam as Role) ? (roleParam as Role) : null;

  const db = getAdminFirestore();
  const col = db.collection("users");
  let docs: { id: string; data: () => Record<string, unknown> }[];

  if (q.length >= 1) {
    const qLower = q.toLowerCase();
    const qEnd = qLower + "\uf8ff";
    const snap = await col
      .where("email", ">=", qLower)
      .where("email", "<=", qEnd)
      .limit(limit * 3)
      .get();
    docs = snap.docs;
  } else {
    let query: Query = col;
    if (statusFilter) query = query.where("status", "==", statusFilter);
    if (roleFilter) query = query.where("role", "==", roleFilter);
    const snap = await query.limit(limit * 2).get();
    docs = snap.docs;
  }

  const agencyIdsFilter = agencyIdParam;

  const results: UserRow[] = [];
  for (const doc of docs) {
    const d = doc.data();
    const primaryAgencyId =
      typeof d.primaryAgencyId === "string" && d.primaryAgencyId.trim()
        ? d.primaryAgencyId.trim()
        : null;
    const agencyIds = Array.isArray(d.agencyIds)
      ? (d.agencyIds as string[]).filter((x) => typeof x === "string")
      : [];
    const legacyAgencyId =
      d.agencyId != null && typeof d.agencyId === "string" ? d.agencyId : null;

    if (statusFilter && (d.status as string) !== statusFilter) continue;
    if (roleFilter && (d.role as string) !== roleFilter) continue;
    if (agencyIdsFilter && !matchesAgency(primaryAgencyId, agencyIds, legacyAgencyId, agencyIdsFilter))
      continue;

    results.push({
      uid: doc.id,
      email: typeof d.email === "string" ? d.email : "",
      role: typeof d.role === "string" ? d.role : "—",
      status: typeof d.status === "string" ? d.status : "—",
      primaryAgencyId: primaryAgencyId ?? legacyAgencyId ?? null,
      agencyIds: agencyIds.length ? agencyIds : undefined,
      agencyId: legacyAgencyId ?? null,
      createdAt: d.createdAt ?? undefined,
      updatedAt: d.updatedAt ?? undefined,
    });
    if (results.length >= limit) break;
  }

  return NextResponse.json({ results });
}
