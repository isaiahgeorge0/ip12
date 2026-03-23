/**
 * GET /api/admin/maintenance?agencyId=...&status=...&priority=...&propertyId=...
 * List maintenance requests. admin = session.agencyId; superAdmin may pass agencyId.
 *
 * POST /api/admin/maintenance
 * Create maintenance request. Body: agencyId, propertyId, tenancyId?, tenantId?, tenantName?, title, description?, priority?.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { maintenanceRequestsCol, propertiesCol, tenanciesCol } from "@/lib/firestore/paths";
import { normalizedDisplayAddress } from "@/lib/admin/normalizePropertyDisplay";
import { serializeTimestamp } from "@/lib/serialization";
import {
  MAINTENANCE_STATUSES,
  MAINTENANCE_PRIORITIES,
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

export type MaintenanceListItem = {
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
};

export async function GET(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { searchParams } = new URL(request.url);
  const agencyIdParam = searchParams.get("agencyId")?.trim() ?? null;
  const statusParam = searchParams.get("status")?.trim() ?? null;
  const priorityParam = searchParams.get("priority")?.trim() ?? null;
  const propertyIdParam = searchParams.get("propertyId")?.trim() ?? null;

  const agencyId = resolveAgencyId(session, { agencyId: agencyIdParam ?? undefined });
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  let query: FirebaseFirestore.Query = db
    .collection(maintenanceRequestsCol(agencyId))
    .orderBy("createdAt", "desc")
    .limit(200);

  const snap = await query.get();
  let docs = snap.docs;

  if (statusParam && isMaintenanceStatus(statusParam)) {
    docs = docs.filter((d) => (d.data().status as string) === statusParam);
  }
  if (priorityParam && isMaintenancePriority(priorityParam)) {
    docs = docs.filter((d) => (d.data().priority as string) === priorityParam);
  }
  if (propertyIdParam) {
    docs = docs.filter((d) => (d.data().propertyId as string) === propertyIdParam);
  }

  const list: MaintenanceListItem[] = docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
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
    };
  });

  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  let body: {
    agencyId?: string;
    propertyId?: string;
    tenancyId?: string | null;
    tenantId?: string | null;
    tenantName?: string | null;
    title?: string;
    description?: string | null;
    priority?: string;
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

  const propertyId = typeof body?.propertyId === "string" ? body.propertyId.trim() : "";
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const tenancyId = typeof body?.tenancyId === "string" ? body.tenancyId.trim() || null : null;
  const tenantId = typeof body?.tenantId === "string" ? body.tenantId.trim() || null : null;
  const tenantName = typeof body?.tenantName === "string" ? body.tenantName.trim() || null : null;
  const description = typeof body?.description === "string" ? body.description.trim() || null : null;
  const priority = isMaintenancePriority(body?.priority) ? (body.priority as MaintenancePriority) : "normal";

  const db = getAdminFirestore();
  const propRef = db.doc(`${propertiesCol(agencyId)}/${propertyId}`);
  const propSnap = await propRef.get();
  if (!propSnap.exists) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }
  const propertyDisplayLabel = normalizedDisplayAddress(propSnap.data() ?? {}, propertyId);

  let resolvedTenantName = tenantName;
  if (!resolvedTenantName && tenancyId) {
    const tenancySnap = await db.doc(`${tenanciesCol(agencyId)}/${tenancyId}`).get();
    if (tenancySnap.exists) {
      resolvedTenantName = (tenancySnap.data()?.tenantName as string) ?? null;
    }
  }

  const now = FieldValue.serverTimestamp();
  const ref = await db.collection(maintenanceRequestsCol(agencyId)).add({
    agencyId,
    propertyId,
    propertyDisplayLabel,
    tenancyId,
    tenantId,
    tenantName: resolvedTenantName,
    title,
    description,
    priority,
    status: "reported",
    contractorId: null,
    contractorName: null,
    reportedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: session.uid,
  });

  return NextResponse.json({
    ok: true,
    id: ref.id,
    agencyId,
    propertyId,
    status: "reported",
  });
}
