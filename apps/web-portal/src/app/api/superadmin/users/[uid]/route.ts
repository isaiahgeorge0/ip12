import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertSuperAdminApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { userDoc } from "@/lib/firestore/paths";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import type { Role } from "@/lib/types/roles";

const ALLOWED_STATUS = ["active", "disabled"] as const;
const ROLES: Role[] = ["superAdmin", "admin", "agent", "landlord", "tenant", "contractor", "lead"];

type PatchBody = {
  status?: (typeof ALLOWED_STATUS)[number];
  role?: Role;
  primaryAgencyId?: string | null;
  agencyIds?: string[];
};

function parseBody(body: unknown): PatchBody | null {
  if (body == null || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const out: PatchBody = {};
  if (o.status !== undefined) {
    if (typeof o.status !== "string" || !ALLOWED_STATUS.includes(o.status as (typeof ALLOWED_STATUS)[number]))
      return null;
    out.status = o.status as (typeof ALLOWED_STATUS)[number];
  }
  if (o.role !== undefined) {
    if (typeof o.role !== "string" || !ROLES.includes(o.role as Role)) return null;
    out.role = o.role as Role;
  }
  if (o.primaryAgencyId !== undefined) {
    if (o.primaryAgencyId !== null && typeof o.primaryAgencyId !== "string") return null;
    out.primaryAgencyId = o.primaryAgencyId === null ? null : (o.primaryAgencyId as string).trim() || null;
  }
  if (o.agencyIds !== undefined) {
    if (!Array.isArray(o.agencyIds)) return null;
    const arr = (o.agencyIds as unknown[]).filter((x) => typeof x === "string") as string[];
    out.agencyIds = [...new Set(arr)];
  }
  return out;
}

/**
 * PATCH /api/superadmin/users/[uid]
 * SuperAdmin only. Allowlisted fields: status (active|disabled), role, primaryAgencyId, agencyIds.
 * Writes audit log for changes.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ uid: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertSuperAdminApi(session);
  if (role403) return role403;

  const { uid } = await context.params;
  if (!uid?.trim()) {
    return NextResponse.json({ error: "uid required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch = parseBody(body);
  if (patch === null || Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Invalid or empty body; allowlisted: status, role, primaryAgencyId, agencyIds" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.doc(userDoc(uid));
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const before = snap.data() as Record<string, unknown>;
  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.role !== undefined) updates.role = patch.role;
  if (patch.primaryAgencyId !== undefined) updates.primaryAgencyId = patch.primaryAgencyId;
  if (patch.agencyIds !== undefined) updates.agencyIds = patch.agencyIds;

  const meta: Record<string, unknown> = {};
  if (patch.status !== undefined) meta.status = { before: before.status, after: patch.status };
  if (patch.role !== undefined) meta.role = { before: before.role, after: patch.role };
  if (patch.primaryAgencyId !== undefined)
    meta.primaryAgencyId = { before: before.primaryAgencyId ?? null, after: patch.primaryAgencyId };
  if (patch.agencyIds !== undefined) meta.agencyIds = { before: before.agencyIds ?? [], after: patch.agencyIds };

  await ref.update(updates);

  if (patch.status !== undefined) {
    writeAuditLog({
      action: "USER_STATUS_CHANGED",
      actorUid: session.uid,
      actorRole: "superAdmin",
      actorAgencyId: session.agencyId,
      targetType: "user",
      targetId: uid,
      agencyId: null,
      meta,
      bypass: true,
    });
  }
  if (patch.role !== undefined) {
    writeAuditLog({
      action: "USER_ROLE_CHANGED",
      actorUid: session.uid,
      actorRole: "superAdmin",
      actorAgencyId: session.agencyId,
      targetType: "user",
      targetId: uid,
      agencyId: null,
      meta,
      bypass: true,
    });
  }
  if (patch.primaryAgencyId !== undefined || patch.agencyIds !== undefined) {
    writeAuditLog({
      action: "USER_AGENCY_UPDATED",
      actorUid: session.uid,
      actorRole: "superAdmin",
      actorAgencyId: session.agencyId,
      targetType: "user",
      targetId: uid,
      agencyId: null,
      meta,
      bypass: true,
    });
  }

  const updatedSnap = await ref.get();
  const updated = updatedSnap.exists ? (updatedSnap.data() as Record<string, unknown>) : before;
  const primaryAgencyId =
    typeof updated.primaryAgencyId === "string" && updated.primaryAgencyId.trim()
      ? updated.primaryAgencyId.trim()
      : null;
  const agencyIds = Array.isArray(updated.agencyIds)
    ? (updated.agencyIds as string[]).filter((x) => typeof x === "string")
    : [];
  const legacyAgencyId =
    updated.agencyId != null && typeof updated.agencyId === "string" ? updated.agencyId : null;

  return NextResponse.json({
    uid,
    email: typeof updated.email === "string" ? updated.email : "",
    role: typeof updated.role === "string" ? updated.role : "—",
    status: typeof updated.status === "string" ? updated.status : "—",
    primaryAgencyId: primaryAgencyId ?? legacyAgencyId ?? null,
    agencyIds: agencyIds.length ? agencyIds : undefined,
    agencyId: legacyAgencyId ?? null,
    createdAt: updated.createdAt ?? undefined,
    updatedAt: updated.updatedAt ?? undefined,
  });
}
