import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertSuperAdminApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { agencyDoc } from "@/lib/firestore/paths";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

const ALLOWED_STATUS = ["active", "disabled"] as const;

type PatchBody = {
  name?: string;
  status?: (typeof ALLOWED_STATUS)[number];
};

function parseBody(body: unknown): PatchBody | null {
  if (body == null || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const out: PatchBody = {};
  if (o.name !== undefined) {
    if (typeof o.name !== "string") return null;
    out.name = o.name.trim();
  }
  if (o.status !== undefined) {
    if (typeof o.status !== "string" || !ALLOWED_STATUS.includes(o.status as (typeof ALLOWED_STATUS)[number]))
      return null;
    out.status = o.status as (typeof ALLOWED_STATUS)[number];
  }
  return out;
}

/**
 * PATCH /api/superadmin/agencies/[agencyId]
 * SuperAdmin only. Allowlisted: name, status. Writes AGENCY_UPDATED audit.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ agencyId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertSuperAdminApi(session);
  if (role403) return role403;

  const { agencyId } = await context.params;
  if (!agencyId?.trim()) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch = parseBody(body);
  if (patch === null || Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Invalid or empty body; allowlisted: name, status" },
      { status: 400 }
    );
  }

  const db = getAdminFirestore();
  const ref = db.doc(agencyDoc(agencyId));
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Agency not found" }, { status: 404 });
  }

  const before = snap.data() as Record<string, unknown>;
  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.status !== undefined) updates.status = patch.status;

  const meta: Record<string, unknown> = {};
  if (patch.name !== undefined) meta.name = { before: before.name ?? null, after: patch.name };
  if (patch.status !== undefined) meta.status = { before: before.status ?? null, after: patch.status };

  await ref.update(updates);

  writeAuditLog({
    action: "AGENCY_UPDATED",
    actorUid: session.uid,
    actorRole: "superAdmin",
    actorAgencyId: session.agencyId,
    targetType: "agency",
    targetId: agencyId,
    agencyId: agencyId,
    meta,
    bypass: true,
  });

  const updatedSnap = await ref.get();
  const updated = updatedSnap.exists ? (updatedSnap.data() as Record<string, unknown>) : before;
  return NextResponse.json({
    agencyId,
    name: typeof updated.name === "string" ? updated.name : agencyId,
    status: typeof updated.status === "string" ? updated.status : "active",
    createdAt: updated.createdAt ?? undefined,
    updatedAt: updated.updatedAt ?? undefined,
  });
}
