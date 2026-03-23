/**
 * GET /api/admin/tenancies/[tenancyId]?agencyId=...
 * Returns single tenancy with linked records. admin = own agency; superAdmin may pass agencyId.
 *
 * PATCH /api/admin/tenancies/[tenancyId]
 * Update tenancy operational fields. Writes TENANCY_UPDATED or TENANCY_STATUS_UPDATED.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  tenanciesCol,
  propertiesCol,
  applicationsCol,
  staffActionQueueCol,
  offersCol,
  propertyLandlordsCol,
  userDoc,
} from "@/lib/firestore/paths";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";
import { serializeTimestamp } from "@/lib/serialization";
import { TENANCY_STATUSES, type TenancyStatus } from "@/lib/types/tenancy";
import { writeTenancyAudit } from "@/lib/audit/tenancyAudit";
import { rentPaymentsCol } from "@/lib/firestore/paths";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenancyId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { tenancyId } = await params;
  if (!tenancyId) {
    return NextResponse.json({ error: "tenancyId required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const agencyIdParam = searchParams.get("agencyId")?.trim() || null;
  const agencyId = resolveAgencyId(session, { agencyId: agencyIdParam ?? undefined });
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.collection(tenanciesCol(agencyId)).doc(tenancyId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Tenancy not found" }, { status: 404 });
  }

  const d = snap.data()!;
  const propertyId = (d.propertyId as string) ?? "";
  const applicantId = typeof d.applicantId === "string" ? d.applicantId : null;
  const offerId = (d.offerId as string) ?? "";
  const createdFromQueueItemId = (d.createdFromQueueItemId as string) ?? "";

  const result: Record<string, unknown> = {
    id: snap.id,
    agencyId: d.agencyId ?? agencyId,
    propertyId,
    propertyDisplayLabel: (d.propertyDisplayLabel as string) ?? propertyId ? `Property ${propertyId}` : "—",
    applicantId: d.applicantId ?? null,
    applicantUserId: d.applicantUserId ?? null,
    applicationId: d.applicationId ?? null,
    offerId,
    tenantName: (d.tenantName as string) ?? "",
    tenantEmail: (d.tenantEmail as string) ?? "",
    tenantPhone: typeof d.tenantPhone === "string" ? d.tenantPhone : null,
    rentAmount: typeof d.rentAmount === "number" && Number.isFinite(d.rentAmount) ? d.rentAmount : 0,
    currency: (d.currency as string) ?? "GBP",
    deposit: typeof d.deposit === "number" && Number.isFinite(d.deposit) ? d.deposit : null,
    moveInDate: typeof d.moveInDate === "string" ? d.moveInDate : null,
    tenancyStartDate: typeof d.tenancyStartDate === "string" ? d.tenancyStartDate : null,
    tenancyEndDate: typeof d.tenancyEndDate === "string" ? d.tenancyEndDate : null,
    status: TENANCY_STATUSES.includes((d.status as TenancyStatus)) ? d.status : "active",
    createdFromQueueItemId,
    createdAt: serializeTimestamp(d.createdAt),
    updatedAt: serializeTimestamp(d.updatedAt),
    createdBy: (d.createdBy as string) ?? "",
    notes: typeof d.notes === "string" ? d.notes : null,
  };

  const propRef = db.doc(`${propertiesCol(agencyId)}/${propertyId}`);
  const propSnap = await propRef.get();
  if (propSnap.exists) {
    const p = propSnap.data()!;
    result.linkedProperty = {
      id: propertyId,
      displayLabel: propertyDisplayLabel(p, propertyId),
    };
    result.propertyDisplayLabel = (result.linkedProperty as { displayLabel: string }).displayLabel;
    if (typeof p.status === "string") result.propertyStatus = p.status;
  }

  if (applicantId) {
    const appRef = db.doc(`${applicationsCol(agencyId)}/${applicantId}`);
    const appSnap = await appRef.get();
    if (appSnap.exists) {
      const a = appSnap.data()!;
      result.linkedApplicant = {
        id: applicantId,
        name: (a.fullName as string) ?? (a.applicantName as string) ?? "",
        email: (a.email as string) ?? "",
      };
    }
  }

  if (offerId) {
    const offerRef = db.collection(offersCol(agencyId)).doc(offerId);
    const offerSnap = await offerRef.get();
    if (offerSnap.exists) {
      const o = offerSnap.data()!;
      result.linkedOffer = {
        id: offerId,
        amount: typeof o.amount === "number" ? o.amount : 0,
        currency: (o.currency as string) ?? "GBP",
        status: (o.status as string) ?? "",
      };
    }
  }

  if (createdFromQueueItemId) {
    const queueRef = db.collection(staffActionQueueCol(agencyId)).doc(createdFromQueueItemId);
    const queueSnap = await queueRef.get();
    if (queueSnap.exists) {
      const q = queueSnap.data()!;
      result.linkedQueue = {
        id: createdFromQueueItemId,
        stage: (q.stage as string) ?? "",
      };
    }
  }

  const joinSnap = await db
    .collection(propertyLandlordsCol())
    .where("propertyId", "==", propertyId)
    .where("agencyId", "==", agencyId)
    .limit(5)
    .get();
  const joinDoc = joinSnap.docs.find((doc) => (doc.data().status as string) !== "removed");
  if (joinDoc) {
    const landlordUid = joinDoc.data().landlordUid as string | undefined;
    if (landlordUid) {
      const userSnap = await db.doc(userDoc(landlordUid)).get();
      const u = userSnap.data();
      result.linkedLandlord = {
        uid: landlordUid,
        displayName: (u?.displayName as string) ?? (u?.email as string) ?? landlordUid,
      };
      result.landlordUid = landlordUid;
      result.landlordName = (result.linkedLandlord as { displayName: string }).displayName;
    }
  }

  return NextResponse.json(result);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenancyId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { tenancyId } = await params;
  if (!tenancyId) {
    return NextResponse.json({ error: "tenancyId required" }, { status: 400 });
  }

  let body: {
    tenancyStartDate?: string | null;
    tenancyEndDate?: string | null;
    status?: string;
    tenantPhone?: string | null;
    notes?: string | null;
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
  const ref = db.collection(tenanciesCol(agencyId)).doc(tenancyId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Tenancy not found" }, { status: 404 });
  }

  const d = snap.data()!;
  const statusBefore = (TENANCY_STATUSES.includes((d.status as TenancyStatus)) ? d.status : "active") as TenancyStatus;

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: session.uid,
  };

  if (body.tenancyStartDate !== undefined) {
    updates.tenancyStartDate = typeof body.tenancyStartDate === "string" ? body.tenancyStartDate.trim() || null : null;
  }
  if (body.tenancyEndDate !== undefined) {
    updates.tenancyEndDate = typeof body.tenancyEndDate === "string" ? body.tenancyEndDate.trim() || null : null;
  }
  if (typeof body?.status === "string" && body.status.trim()) {
    const newStatus = body.status.trim() as TenancyStatus;
    if (!TENANCY_STATUSES.includes(newStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${TENANCY_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    updates.status = newStatus;
  }
  if (body.tenantPhone !== undefined) {
    updates.tenantPhone = typeof body.tenantPhone === "string" ? body.tenantPhone.trim() || null : null;
  }
  if (body.notes !== undefined) {
    updates.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  }

  if (Object.keys(updates).length <= 2) {
    return NextResponse.json({ ok: true });
  }

  await ref.update(updates);

  const statusAfter = (updates.status as TenancyStatus) ?? statusBefore;
  // When tenancy first becomes active, create initial rent schedule if none exists yet.
  if (statusBefore !== "active" && statusAfter === "active") {
    const tenancyIdForSchedule = tenancyId;
    const agencyIdForSchedule = agencyId;
    const dbForSchedule = db;
    const rentCol = dbForSchedule.collection(rentPaymentsCol(agencyIdForSchedule));
    const existingSchedule = await rentCol.where("tenancyId", "==", tenancyIdForSchedule).limit(1).get();
    if (existingSchedule.empty) {
      const propertyId = (d.propertyId as string) ?? "";
      const propertyDisplay = (d.propertyDisplayLabel as string) ?? null;
      const tenantName = (d.tenantName as string) ?? "";
      const rentAmount =
        typeof d.rentAmount === "number" && Number.isFinite(d.rentAmount) && d.rentAmount >= 0
          ? (d.rentAmount as number)
          : 0;
      const tenancyStartDate =
        typeof (updates.tenancyStartDate ?? d.tenancyStartDate) === "string" &&
        (updates.tenancyStartDate ?? d.tenancyStartDate)
          ? ((updates.tenancyStartDate ?? d.tenancyStartDate) as string)
          : null;
      const moveInDate =
        typeof d.moveInDate === "string" && d.moveInDate ? (d.moveInDate as string) : null;

      let firstDue: string;
      if (tenancyStartDate) {
        firstDue = tenancyStartDate;
      } else if (moveInDate) {
        firstDue = moveInDate;
      } else {
        const today = new Date();
        const iso = today.toISOString().slice(0, 10);
        firstDue = iso;
      }

      const base = new Date(firstDue);
      if (!Number.isFinite(base.getTime())) {
        const today = new Date();
        base.setTime(today.getTime());
      }

      const nowTs = FieldValue.serverTimestamp();
      const writes: Promise<FirebaseFirestore.DocumentReference>[] = [];
      for (let i = 0; i < 12; i++) {
        const due = new Date(base);
        due.setMonth(due.getMonth() + i);
        const dueDate = due.toISOString().slice(0, 10);
        writes.push(
          rentCol.add({
            agencyId: agencyIdForSchedule,
            tenancyId: tenancyIdForSchedule,
            propertyId,
            propertyDisplayLabel: propertyDisplay,
            tenantName,
            rentAmount,
            dueDate,
            status: "due",
            paidAt: null,
            amountPaid: null,
            notes: null,
            createdAt: nowTs,
            updatedAt: nowTs,
            createdBy: session.uid,
          })
        );
      }
      await Promise.all(writes);
    }
  }
  if (statusAfter !== statusBefore) {
    writeTenancyAudit({
      action: "TENANCY_STATUS_UPDATED",
      actorUid: session.uid,
      actorAgencyId: session.agencyId ?? null,
      role: session.role,
      tenancyId,
      agencyId,
      propertyId: (d.propertyId as string) ?? "",
      applicantId: (d.applicantId as string) ?? undefined,
      offerId: (d.offerId as string) ?? undefined,
      statusBefore,
      statusAfter,
    });
  } else {
    writeTenancyAudit({
      action: "TENANCY_UPDATED",
      actorUid: session.uid,
      actorAgencyId: session.agencyId ?? null,
      role: session.role,
      tenancyId,
      agencyId,
      propertyId: (d.propertyId as string) ?? "",
      applicantId: (d.applicantId as string) ?? undefined,
      offerId: (d.offerId as string) ?? undefined,
      status: statusBefore,
    });
  }

  return NextResponse.json({ ok: true });
}
