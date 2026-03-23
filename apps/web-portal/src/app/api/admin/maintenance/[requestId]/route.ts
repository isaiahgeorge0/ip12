/**
 * GET /api/admin/maintenance/[requestId]?agencyId=...
 * Returns single maintenance request.
 *
 * PATCH /api/admin/maintenance/[requestId]
 * Update status, contractorId, etc. Body: agencyId, status?, contractorId?, contractorName?, completedAt?.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { maintenanceRequestsCol, contractorsCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import {
  MAINTENANCE_STATUSES,
  isMaintenanceStatus,
  isMaintenancePriority,
  type MaintenanceStatus,
  type MaintenancePriority,
} from "@/lib/types/maintenanceRequest";

function resolveAgencyId(
  session: { role: string; agencyId: string | null },
  params: { agencyId?: string }
): string | null {
  let agencyId = session.agencyId ?? "";
  if (!agencyId && session.role === "superAdmin" && typeof params?.agencyId === "string") {
    agencyId = params.agencyId.trim();
  }
  return agencyId || null;
}

export type MaintenanceRequestDetail = {
  id: string;
  agencyId: string;
  propertyId: string;
  propertyDisplayLabel: string | null;
  tenancyId: string | null;
  tenantId: string | null;
  tenantName: string | null;
  title: string;
  description: string | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  contractorId: string | null;
  contractorName: string | null;
  reportedAt: number | null;
  completedAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
  createdBy: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { requestId } = await params;
  if (!requestId) {
    return NextResponse.json({ error: "requestId required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const agencyId = resolveAgencyId(session, { agencyId: searchParams.get("agencyId")?.trim() ?? undefined });
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.collection(maintenanceRequestsCol(agencyId)).doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Maintenance request not found" }, { status: 404 });
  }

  const d = snap.data()!;
  const result: MaintenanceRequestDetail = {
    id: snap.id,
    agencyId: (d.agencyId as string) ?? agencyId,
    propertyId: (d.propertyId as string) ?? "",
    propertyDisplayLabel: typeof d.propertyDisplayLabel === "string" ? d.propertyDisplayLabel : null,
    tenancyId: typeof d.tenancyId === "string" ? d.tenancyId : null,
    tenantId: typeof d.tenantId === "string" ? d.tenantId : null,
    tenantName: typeof d.tenantName === "string" ? d.tenantName : null,
    title: (d.title as string) ?? "",
    description: typeof d.description === "string" ? d.description : null,
    priority: isMaintenancePriority(d.priority) ? (d.priority as MaintenancePriority) : "normal",
    status: isMaintenanceStatus(d.status) ? (d.status as MaintenanceStatus) : "reported",
    contractorId: typeof d.contractorId === "string" ? d.contractorId : null,
    contractorName: typeof d.contractorName === "string" ? d.contractorName : null,
    reportedAt: serializeTimestamp(d.reportedAt) ?? null,
    completedAt: serializeTimestamp(d.completedAt) ?? null,
    createdAt: serializeTimestamp(d.createdAt) ?? null,
    updatedAt: serializeTimestamp(d.updatedAt) ?? null,
    createdBy: (d.createdBy as string) ?? "",
  };

  return NextResponse.json(result);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { requestId } = await params;
  if (!requestId) {
    return NextResponse.json({ error: "requestId required" }, { status: 400 });
  }

  let body: {
    agencyId?: string;
    status?: string;
    contractorId?: string | null;
    contractorName?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const agencyId = resolveAgencyId(session, body);
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.collection(maintenanceRequestsCol(agencyId)).doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Maintenance request not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (typeof body?.status === "string" && body.status.trim()) {
    const newStatus = body.status.trim() as MaintenanceStatus;
    if (!MAINTENANCE_STATUSES.includes(newStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${MAINTENANCE_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    updates.status = newStatus;
    if (newStatus === "completed") {
      updates.completedAt = FieldValue.serverTimestamp();
    }
  }

  if (body?.contractorId !== undefined) {
    updates.contractorId = typeof body.contractorId === "string" && body.contractorId.trim() ? body.contractorId.trim() : null;
    if (updates.contractorId && typeof body?.contractorName === "string") {
      updates.contractorName = body.contractorName.trim() || null;
    } else if (updates.contractorId === null) {
      updates.contractorName = null;
    } else if (updates.contractorId) {
      const contractorSnap = await db.doc(`${contractorsCol(agencyId)}/${updates.contractorId}`).get();
      updates.contractorName = contractorSnap.exists ? (contractorSnap.data()?.name as string) ?? null : null;
    }
  } else if (body?.contractorName !== undefined) {
    updates.contractorName = typeof body.contractorName === "string" && body.contractorName.trim() ? body.contractorName.trim() : null;
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ ok: true });
  }

  await ref.update(updates);
  return NextResponse.json({ ok: true });
}
