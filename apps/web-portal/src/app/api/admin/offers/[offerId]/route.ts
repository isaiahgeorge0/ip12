/**
 * GET /api/admin/offers/[offerId]?agencyId=...
 * Returns single offer. admin = own agency; superAdmin may pass agencyId.
 *
 * PATCH /api/admin/offers/[offerId]
 * Update offer. Body: status?, notes?, agencyId? (for superAdmin). Writes OFFER_UPDATED or OFFER_STATUS_UPDATED.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { offersCol, tenanciesCol, applicationsCol } from "@/lib/firestore/paths";
import { writeOfferAudit } from "@/lib/audit/offerAudit";
import { writeTenancyAudit } from "@/lib/audit/tenancyAudit";
import { serializeTimestamp } from "@/lib/serialization";
import { OFFER_STATUSES, type OfferStatus } from "@/lib/types/offer";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { offerId } = await params;
  if (!offerId) {
    return NextResponse.json({ error: "offerId required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const agencyIdParam = searchParams.get("agencyId")?.trim() || null;
  const agencyId = resolveAgencyId(session, { agencyId: agencyIdParam ?? undefined });
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.collection(offersCol(agencyId)).doc(offerId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  const d = snap.data()!;
  return NextResponse.json({
    id: snap.id,
    agencyId: d.agencyId ?? agencyId,
    propertyId: d.propertyId ?? "",
    propertyDisplayLabel: d.propertyDisplayLabel ?? "",
    applicantId: d.applicantId ?? null,
    applicantUserId: d.applicantUserId ?? null,
    applicantName: d.applicantName ?? null,
    applicantEmail: d.applicantEmail ?? null,
    applicationId: d.applicationId ?? null,
    amount: typeof d.amount === "number" && Number.isFinite(d.amount) ? d.amount : 0,
    currency: d.currency ?? "GBP",
    deposit: typeof d.deposit === "number" && Number.isFinite(d.deposit) ? d.deposit : null,
    moveInDate: typeof d.moveInDate === "string" ? d.moveInDate : null,
    status: OFFER_STATUSES.includes((d.status as OfferStatus)) ? d.status : "draft",
    notes: typeof d.notes === "string" ? d.notes : null,
    source: d.source === "application" ? "application" : "manual",
    sentAt: serializeTimestamp(d.sentAt),
    createdAt: serializeTimestamp(d.createdAt),
    updatedAt: serializeTimestamp(d.updatedAt),
    createdBy: d.createdBy ?? "",
    updatedBy: d.updatedBy ?? "",
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { offerId } = await params;
  if (!offerId) {
    return NextResponse.json({ error: "offerId required" }, { status: 400 });
  }

  let body: {
    status?: string;
    notes?: string | null;
    deposit?: number | null;
    moveInDate?: string | null;
    agencyId?: string;
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
  const ref = db.collection(offersCol(agencyId)).doc(offerId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  const d = snap.data()!;
  const statusBefore = (OFFER_STATUSES.includes((d.status as OfferStatus)) ? d.status : "draft") as OfferStatus;

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: session.uid,
  };

  if (typeof body?.status === "string" && body.status.trim()) {
    const newStatus = body.status.trim() as OfferStatus;
    if (!OFFER_STATUSES.includes(newStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${OFFER_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    updates.status = newStatus;
    if (newStatus === "sent" && d.sentAt == null) {
      updates.sentAt = FieldValue.serverTimestamp();
    }
  }

  if (body?.notes !== undefined) {
    updates.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  }
  if (body?.deposit !== undefined) {
    updates.deposit =
      typeof body.deposit === "number" && Number.isFinite(body.deposit) && body.deposit >= 0
        ? body.deposit
        : null;
  }
  if (body?.moveInDate !== undefined) {
    updates.moveInDate =
      typeof body.moveInDate === "string" && body.moveInDate.trim() ? body.moveInDate.trim() : null;
  }

  if (Object.keys(updates).length <= 2) {
    return NextResponse.json({ ok: true });
  }

  await ref.update(updates);

  const statusAfter = (updates.status as OfferStatus) ?? statusBefore;
  if (statusAfter !== statusBefore) {
    writeOfferAudit({
      action: "OFFER_STATUS_UPDATED",
      actorUid: session.uid,
      actorAgencyId: session.agencyId,
      role: session.role,
      offerId,
      agencyId,
      propertyId: (d.propertyId as string) ?? "",
      applicantId: (d.applicantId as string) ?? undefined,
      applicationId: (d.applicationId as string) ?? undefined,
      statusBefore,
      statusAfter,
    });
  } else {
    writeOfferAudit({
      action: "OFFER_UPDATED",
      actorUid: session.uid,
      actorAgencyId: session.agencyId,
      role: session.role,
      offerId,
      agencyId,
      propertyId: (d.propertyId as string) ?? "",
      applicantId: (d.applicantId as string) ?? undefined,
      applicationId: (d.applicationId as string) ?? undefined,
      status: statusBefore,
    });
  }

  if (statusAfter === "accepted") {
    const tenancyCol = db.collection(tenanciesCol(agencyId));
    const existingTenancy = await tenancyCol.where("offerId", "==", offerId).limit(1).get();
    if (existingTenancy.empty) {
      const propertyId = (d.propertyId as string) ?? "";
      const propertyDisplayLabel = (d.propertyDisplayLabel as string) ?? `Property ${propertyId}`;
      const applicantId = typeof d.applicantId === "string" ? d.applicantId : null;
      const tenantName = (typeof d.applicantName === "string" ? d.applicantName : "").trim() || "—";
      const tenantEmail = (typeof d.applicantEmail === "string" ? d.applicantEmail : "").trim() || "";
      let tenantPhone: string | null = null;
      if (applicantId) {
        const appSnap = await db.doc(`${applicationsCol(agencyId)}/${applicantId}`).get();
        if (appSnap.exists) {
          const phone = appSnap.data()?.phone;
          tenantPhone = typeof phone === "string" && phone.trim() ? phone.trim() : null;
        }
      }
      const rentAmount = typeof d.amount === "number" && Number.isFinite(d.amount) ? d.amount : 0;
      const deposit = typeof d.deposit === "number" && Number.isFinite(d.deposit) ? d.deposit : null;
      const moveInDate = typeof d.moveInDate === "string" && d.moveInDate.trim() ? d.moveInDate.trim() : null;
      const tenancyRef = await tenancyCol.add({
        agencyId,
        propertyId,
        propertyDisplayLabel,
        applicantId,
        applicantUserId: d.applicantUserId ?? null,
        applicationId: d.applicationId ?? null,
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
        tenancyId: tenancyRef.id,
        agencyId,
        propertyId,
        applicantId: applicantId ?? undefined,
        offerId,
        status: "preparing",
      });
    }
  }

  return NextResponse.json({ ok: true });
}
