/**
 * GET /api/admin/tenancies?agencyId=...
 * List tenancies for the agency. admin = session.agencyId; superAdmin may pass agencyId.
 *
 * POST /api/admin/tenancies
 * Create tenancy (e.g. from accepted offer). Body: agencyId, propertyId, applicantId, offerId, rent, deposit?, moveInDate?, tenantName, tenantEmail, tenantPhone?.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { tenanciesCol, propertiesCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import { normalizedDisplayAddress } from "@/lib/admin/normalizePropertyDisplay";
import { TENANCY_STATUSES, type TenancyStatus } from "@/lib/types/tenancy";
import { writeTenancyAudit } from "@/lib/audit/tenancyAudit";

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

export type TenancyListItem = {
  id: string;
  agencyId: string;
  propertyId: string;
  propertyDisplayLabel: string;
  applicantId: string | null;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string | null;
  rentAmount: number;
  currency: string;
  deposit: number | null;
  moveInDate: string | null;
  tenancyStartDate: string | null;
  tenancyEndDate: string | null;
  status: TenancyStatus;
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
  const agencyIdParam = searchParams.get("agencyId")?.trim() || null;

  const agencyId = resolveAgencyId(session, { agencyId: agencyIdParam ?? undefined });
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const snap = await db.collection(tenanciesCol(agencyId)).orderBy("createdAt", "desc").get();

  const list: TenancyListItem[] = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      agencyId: (d.agencyId as string) ?? agencyId,
      propertyId: (d.propertyId as string) ?? "",
      propertyDisplayLabel: (d.propertyDisplayLabel as string) ?? "",
      applicantId: typeof d.applicantId === "string" ? d.applicantId : null,
      tenantName: (d.tenantName as string) ?? "",
      tenantEmail: (d.tenantEmail as string) ?? "",
      tenantPhone: typeof d.tenantPhone === "string" ? d.tenantPhone : null,
      rentAmount: typeof d.rentAmount === "number" && Number.isFinite(d.rentAmount) ? d.rentAmount : 0,
      currency: (d.currency as string) ?? "GBP",
      deposit: typeof d.deposit === "number" && Number.isFinite(d.deposit) ? d.deposit : null,
      moveInDate: typeof d.moveInDate === "string" ? d.moveInDate : null,
      tenancyStartDate: typeof d.tenancyStartDate === "string" ? d.tenancyStartDate : null,
      tenancyEndDate: typeof d.tenancyEndDate === "string" ? d.tenancyEndDate : null,
      status: (TENANCY_STATUSES as readonly string[]).includes((d.status as string) ?? "") ? (d.status as TenancyStatus) : "active",
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
    applicantId?: string | null;
    offerId?: string;
    rent?: number;
    deposit?: number | null;
    moveInDate?: string | null;
    tenantName?: string;
    tenantEmail?: string;
    tenantPhone?: string | null;
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

  const offerId = typeof body?.offerId === "string" ? body.offerId.trim() : "";
  if (!offerId) {
    return NextResponse.json({ error: "offerId required" }, { status: 400 });
  }

  const rentAmount = typeof body?.rent === "number" && Number.isFinite(body.rent) && body.rent >= 0 ? body.rent : 0;
  const tenantName = typeof body?.tenantName === "string" ? body.tenantName.trim() || "—" : "—";
  const tenantEmail = typeof body?.tenantEmail === "string" ? body.tenantEmail.trim() || "" : "";
  const tenantPhone = typeof body?.tenantPhone === "string" ? body.tenantPhone.trim() || null : null;
  const applicantId = typeof body?.applicantId === "string" ? body.applicantId.trim() || null : null;
  const deposit =
    typeof body?.deposit === "number" && Number.isFinite(body.deposit) && body.deposit >= 0 ? body.deposit : null;
  const moveInDate =
    typeof body?.moveInDate === "string" && body.moveInDate.trim() ? body.moveInDate.trim() : null;

  const db = getAdminFirestore();
  const propRef = db.doc(`${propertiesCol(agencyId)}/${propertyId}`);
  const propSnap = await propRef.get();
  if (!propSnap.exists) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }
  const propData = propSnap.data() ?? {};
  const propertyDisplayLabel = normalizedDisplayAddress(propData, propertyId);

  const col = db.collection(tenanciesCol(agencyId));
  const existing = await col.where("offerId", "==", offerId).limit(1).get();
  if (!existing.empty) {
    return NextResponse.json(
      { error: "Tenancy already exists for this offer", tenancyId: existing.docs[0].id },
      { status: 409 }
    );
  }

  const ref = await col.add({
    agencyId,
    propertyId,
    propertyDisplayLabel,
    applicantId,
    applicantUserId: null,
    applicationId: null,
    offerId,
    tenantName,
    tenantEmail,
    tenantPhone,
    rentAmount,
    currency: "GBP",
    ...(deposit != null && { deposit }),
    ...(moveInDate != null && { moveInDate }),
    tenancyStartDate: null,
    tenancyEndDate: null,
    status: "preparing",
    createdFromQueueItemId: "",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: session.uid,
  });

  writeTenancyAudit({
    action: "TENANCY_CREATED",
    actorUid: session.uid,
    actorAgencyId: session.agencyId ?? null,
    role: session.role,
    tenancyId: ref.id,
    agencyId,
    propertyId,
    applicantId: applicantId ?? undefined,
    offerId,
    status: "preparing",
  });

  return NextResponse.json({
    ok: true,
    id: ref.id,
    agencyId,
    propertyId,
    offerId,
    status: "preparing",
  });
}
