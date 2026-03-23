import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { contractorDoc, jobsCol } from "@/lib/firestore/paths";
import { writeContractorAudit } from "@/lib/audit/contractorAudit";
import { serializeTimestamp } from "@/lib/serialization";

function resolveAgencyId(
  session: { role: string; agencyId: string | null },
  request: NextRequest
): string | null {
  let agencyId = session.agencyId ?? "";
  if (!agencyId && session.role === "superAdmin") {
    agencyId = request.nextUrl.searchParams.get("agencyId")?.trim() ?? "";
  }
  return agencyId || null;
}

/**
 * GET /api/admin/contractors/[contractorId]
 * Returns a single contractor. Optionally includes jobs count.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const agencyId = resolveAgencyId(session, request);
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const { contractorId } = await params;
  if (!contractorId) {
    return NextResponse.json({ error: "contractorId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.doc(contractorDoc(agencyId, contractorId));
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
  }

  const d = snap.data()!;
  const skills = Array.isArray(d.skills) ? d.skills.filter((x: unknown) => typeof x === "string") : [];
  const coverageAreas = Array.isArray(d.coverageAreas)
    ? d.coverageAreas.filter((x: unknown) => typeof x === "string")
    : [];

  const jobsSnap = await db
    .collection(jobsCol(agencyId))
    .where("contractorId", "==", contractorId)
    .get();

  return NextResponse.json({
    id: snap.id,
    agencyId: d.agencyId ?? agencyId,
    displayName: d.displayName ?? "",
    companyName: typeof d.companyName === "string" ? d.companyName : null,
    email: typeof d.email === "string" ? d.email : null,
    phone: typeof d.phone === "string" ? d.phone : null,
    trade: typeof d.trade === "string" ? d.trade : null,
    skills,
    coverageAreas,
    isActive: d.isActive === true,
    notes: typeof d.notes === "string" ? d.notes : null,
    createdAt: serializeTimestamp(d.createdAt) ?? null,
    updatedAt: serializeTimestamp(d.updatedAt) ?? null,
    createdBy: d.createdBy ?? "",
    updatedBy: d.updatedBy ?? "",
    jobsCount: jobsSnap.size,
  });
}

/**
 * PATCH /api/admin/contractors/[contractorId]
 * Update contractor. Editable: displayName, companyName, email, phone, trade, skills, coverageAreas, isActive, notes.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contractorId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const agencyId = resolveAgencyId(session, request);
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const { contractorId } = await params;
  if (!contractorId) {
    return NextResponse.json({ error: "contractorId required" }, { status: 400 });
  }

  let body: {
    displayName?: string;
    companyName?: string;
    email?: string;
    phone?: string;
    trade?: string;
    skills?: string[];
    coverageAreas?: string[];
    isActive?: boolean;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.doc(contractorDoc(agencyId, contractorId));
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
  }

  const data = snap.data()!;
  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: session.uid,
  };

  if (typeof body.displayName === "string") {
    const v = body.displayName.trim();
    if (v) updates.displayName = v;
  }
  if (body.companyName !== undefined) {
    updates.companyName = typeof body.companyName === "string" && body.companyName.trim() ? body.companyName.trim() : null;
  }
  if (body.email !== undefined) {
    updates.email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;
  }
  if (body.phone !== undefined) {
    updates.phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  }
  if (body.trade !== undefined) {
    updates.trade = typeof body.trade === "string" && body.trade.trim() ? body.trade.trim() : null;
  }
  if (Array.isArray(body.skills)) {
    updates.skills = body.skills.filter((x): x is string => typeof x === "string");
  }
  if (Array.isArray(body.coverageAreas)) {
    updates.coverageAreas = body.coverageAreas.filter((x): x is string => typeof x === "string");
  }
  if (typeof body.isActive === "boolean") {
    updates.isActive = body.isActive;
  }
  if (body.notes !== undefined) {
    updates.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  }

  const previousActive = data.isActive === true;
  const nextActive = (updates.isActive as boolean) ?? previousActive;
  const statusChanged = previousActive !== nextActive;

  await ref.update(updates);

  writeContractorAudit({
    action: statusChanged ? "CONTRACTOR_STATUS_UPDATED" : "CONTRACTOR_UPDATED",
    actorUid: session.uid,
    actorAgencyId: session.agencyId,
    role: session.role,
    contractorId,
    agencyId,
    contractorName: (updates.displayName as string) ?? data.displayName,
    ...(statusChanged && {
      previousStatus: previousActive,
      nextStatus: nextActive,
    }),
  });

  const updated = { ...data, ...updates };
  return NextResponse.json({
    id: contractorId,
    agencyId,
    displayName: updated.displayName,
    companyName: updated.companyName ?? null,
    email: updated.email ?? null,
    phone: updated.phone ?? null,
    trade: updated.trade ?? null,
    skills: updated.skills ?? [],
    coverageAreas: updated.coverageAreas ?? [],
    isActive: updated.isActive === true,
    notes: updated.notes ?? null,
  });
}
