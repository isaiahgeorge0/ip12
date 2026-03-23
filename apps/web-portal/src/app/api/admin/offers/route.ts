/**
 * GET /api/admin/offers?agencyId=...&status=...&propertyId=...&applicantId=...
 * List offers for the agency. admin = session.agencyId; superAdmin may pass agencyId.
 *
 * POST /api/admin/offers
 * Create offer. Body: propertyId, amount, status?, applicantId?, applicationId?, applicantUserId?, notes?, source?.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { offersCol, propertiesCol } from "@/lib/firestore/paths";
import { writeOfferAudit } from "@/lib/audit/offerAudit";
import { serializeTimestamp } from "@/lib/serialization";
import { OFFER_STATUSES, type OfferStatus, type OfferSource } from "@/lib/types/offer";
import { normalizedDisplayAddress } from "@/lib/admin/normalizePropertyDisplay";

function resolveAgencyId(
  session: { role: string; agencyId: string | null },
  bodyOrParams: { agencyId?: string }
): string | null {
  let agencyId = session.agencyId ?? "";
  if (!agencyId && session.role === "superAdmin" && typeof bodyOrParams?.agencyId === "string") {
    agencyId = bodyOrParams.agencyId.trim();
  }
  return agencyId || null;
}

export type OfferListItem = {
  id: string;
  agencyId: string;
  propertyId: string;
  propertyDisplayLabel: string;
  applicantId: string | null;
  applicantUserId: string | null;
  applicantName?: string | null;
  applicantEmail?: string | null;
  applicationId: string | null;
  amount: number;
  currency: string;
  deposit: number | null;
  moveInDate: string | null;
  status: OfferStatus;
  source: OfferSource;
  notes: string | null;
  sentAt: number | null;
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
  const statusParam = searchParams.get("status")?.trim() || null;
  const propertyIdParam = searchParams.get("propertyId")?.trim() || null;
  const applicantIdParam = searchParams.get("applicantId")?.trim() || null;

  const agencyId = resolveAgencyId(session, { agencyId: agencyIdParam ?? undefined });
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  let q = db.collection(offersCol(agencyId)).orderBy("updatedAt", "desc");

  // Firestore doesn't support multiple where on different fields without composite index; we filter in memory if needed
  const snap = await q.get();
  let docs = snap.docs;

  if (statusParam && OFFER_STATUSES.includes(statusParam as OfferStatus)) {
    docs = docs.filter((d) => (d.data().status as string) === statusParam);
  }
  if (propertyIdParam) {
    docs = docs.filter((d) => (d.data().propertyId as string) === propertyIdParam);
  }
  if (applicantIdParam) {
    docs = docs.filter((d) => (d.data().applicantId as string) === applicantIdParam);
  }

  const list: OfferListItem[] = docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      agencyId: (d.agencyId as string) ?? agencyId,
      propertyId: (d.propertyId as string) ?? "",
      propertyDisplayLabel: (d.propertyDisplayLabel as string) ?? "",
      applicantId: (d.applicantId as string) ?? null,
      applicantUserId: (d.applicantUserId as string) ?? null,
      applicantName: (d.applicantName as string) ?? null,
      applicantEmail: (d.applicantEmail as string) ?? null,
      applicationId: (d.applicationId as string) ?? null,
      amount: typeof d.amount === "number" && Number.isFinite(d.amount) ? d.amount : 0,
      currency: (d.currency as string) ?? "GBP",
      deposit: typeof d.deposit === "number" && Number.isFinite(d.deposit) ? d.deposit : null,
      moveInDate: typeof d.moveInDate === "string" ? d.moveInDate : null,
      status: (OFFER_STATUSES.includes((d.status as OfferStatus)) ? d.status : "draft") as OfferStatus,
      source: (d.source === "application" ? "application" : "manual") as OfferSource,
      notes: typeof d.notes === "string" ? d.notes : null,
      sentAt: serializeTimestamp(d.sentAt),
      createdAt: serializeTimestamp(d.createdAt),
      updatedAt: serializeTimestamp(d.updatedAt),
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
    amount?: number;
    deposit?: number | null;
    moveInDate?: string | null;
    status?: string;
    applicantId?: string | null;
    applicationId?: string | null;
    applicantUserId?: string | null;
    applicantName?: string | null;
    applicantEmail?: string | null;
    notes?: string | null;
    source?: string;
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

  const amount = typeof body?.amount === "number" && Number.isFinite(body.amount) && body.amount >= 0
    ? body.amount
    : typeof body?.amount === "string"
      ? parseFloat(body.amount)
      : NaN;
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
  }

  const status = typeof body?.status === "string" && OFFER_STATUSES.includes(body.status as OfferStatus)
    ? (body.status as OfferStatus)
    : "draft";
  const source = body?.source === "application" ? "application" : "manual";

  const db = getAdminFirestore();
  const propRef = db.doc(`${propertiesCol(agencyId)}/${propertyId}`);
  const propSnap = await propRef.get();
  if (!propSnap.exists) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }
  const propData = propSnap.data() ?? {};
  const propertyDisplayLabel = normalizedDisplayAddress(propData, propertyId);

  const applicantId = typeof body?.applicantId === "string" ? body.applicantId.trim() || null : null;
  const applicationId = typeof body?.applicationId === "string" ? body.applicationId.trim() || null : null;
  const applicantUserId = typeof body?.applicantUserId === "string" ? body.applicantUserId.trim() || null : null;
  const applicantName = typeof body?.applicantName === "string" ? body.applicantName.trim() || null : null;
  const applicantEmail = typeof body?.applicantEmail === "string" ? body.applicantEmail.trim() || null : null;
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;
  const deposit =
    typeof body?.deposit === "number" && Number.isFinite(body.deposit) && body.deposit >= 0
      ? body.deposit
      : body?.deposit === null || body?.deposit === undefined
        ? null
        : null;
  const moveInDate =
    typeof body?.moveInDate === "string" && body.moveInDate.trim()
      ? body.moveInDate.trim()
      : null;

  const col = db.collection(offersCol(agencyId));
  const ref = await col.add({
    agencyId,
    applicantId: applicantId ?? null,
    applicantUserId: applicantUserId ?? null,
    applicationId: applicationId ?? null,
    propertyId,
    propertyDisplayLabel,
    amount,
    currency: "GBP",
    ...(deposit != null && { deposit }),
    ...(moveInDate != null && { moveInDate }),
    status,
    notes,
    source,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: session.uid,
    updatedBy: session.uid,
    ...(applicantName != null && { applicantName }),
    ...(applicantEmail != null && { applicantEmail }),
  });

  writeOfferAudit({
    action: "OFFER_CREATED",
    actorUid: session.uid,
    actorAgencyId: session.agencyId,
    role: session.role,
    offerId: ref.id,
    agencyId,
    propertyId,
    applicantId: applicantId ?? undefined,
    applicationId: applicationId ?? undefined,
    status,
  });

  return NextResponse.json({
    ok: true,
    id: ref.id,
    agencyId,
    propertyId,
    propertyDisplayLabel,
    amount,
    currency: "GBP",
    status,
    source,
  });
}
