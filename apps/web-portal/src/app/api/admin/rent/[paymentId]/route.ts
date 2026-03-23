import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { rentPaymentsCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import {
  RENT_PAYMENT_STATUSES,
  isRentPaymentStatus,
  type RentPaymentStatus,
} from "@/lib/types/rentPayment";

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
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { paymentId } = await params;
  if (!paymentId) {
    return NextResponse.json({ error: "paymentId required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const agencyIdParam = searchParams.get("agencyId")?.trim() ?? undefined;
  const agencyId = resolveAgencyId(session, { agencyId: agencyIdParam });
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.collection(rentPaymentsCol(agencyId)).doc(paymentId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Rent payment not found" }, { status: 404 });
  }

  const d = snap.data()!;
  const today = new Date().toISOString().slice(0, 10);
  const rawStatus = typeof d.status === "string" && isRentPaymentStatus(d.status) ? (d.status as RentPaymentStatus) : "due";
  const dueDate = typeof d.dueDate === "string" ? d.dueDate : "";
  let effectiveStatus: RentPaymentStatus = rawStatus;
  if (rawStatus === "due" && dueDate && dueDate < today) {
    effectiveStatus = "late";
  }

  const result = {
    id: snap.id,
    agencyId: (d.agencyId as string) ?? agencyId,
    tenancyId: (d.tenancyId as string) ?? "",
    propertyId: (d.propertyId as string) ?? "",
    propertyDisplayLabel: typeof d.propertyDisplayLabel === "string" ? d.propertyDisplayLabel : null,
    tenantName: (d.tenantName as string) ?? "",
    rentAmount: typeof d.rentAmount === "number" && Number.isFinite(d.rentAmount) ? d.rentAmount : 0,
    dueDate,
    status: effectiveStatus,
    paidAt: serializeTimestamp(d.paidAt) ?? null,
    amountPaid:
      typeof d.amountPaid === "number" && Number.isFinite(d.amountPaid) && d.amountPaid >= 0
        ? (d.amountPaid as number)
        : null,
    notes: typeof d.notes === "string" ? d.notes : null,
    createdAt: serializeTimestamp(d.createdAt) ?? null,
    updatedAt: serializeTimestamp(d.updatedAt) ?? null,
    createdBy: (d.createdBy as string) ?? "",
  };

  return NextResponse.json(result);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { paymentId } = await params;
  if (!paymentId) {
    return NextResponse.json({ error: "paymentId required" }, { status: 400 });
  }

  let body: {
    agencyId?: string;
    status?: string;
    amountPaid?: number | null;
    notes?: string | null;
    rentAmount?: number;
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
  const ref = db.collection(rentPaymentsCol(agencyId)).doc(paymentId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Rent payment not found" }, { status: 404 });
  }
  const d = snap.data()!;
  const rawDueDate = typeof d.dueDate === "string" ? d.dueDate : "";
  const today = new Date().toISOString().slice(0, 10);

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  let statusAfter: RentPaymentStatus | undefined;

  if (typeof body?.status === "string" && body.status.trim()) {
    let newStatus = body.status.trim() as RentPaymentStatus;
    // Prevent reverting overdue payments back to "due"
    if (newStatus === "due" && rawDueDate && rawDueDate < today) {
      newStatus = "late";
    }
    if (!isRentPaymentStatus(newStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${RENT_PAYMENT_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    updates.status = newStatus;
    statusAfter = newStatus;
  }

  if (body.amountPaid !== undefined) {
    if (
      body.amountPaid !== null &&
      !(typeof body.amountPaid === "number" && Number.isFinite(body.amountPaid) && body.amountPaid >= 0)
    ) {
      return NextResponse.json({ error: "amountPaid must be a number >= 0 or null" }, { status: 400 });
    }
    updates.amountPaid = body.amountPaid;
  }

  if (body.notes !== undefined) {
    updates.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  }

  if (body.rentAmount !== undefined) {
    if (!(typeof body.rentAmount === "number" && Number.isFinite(body.rentAmount) && body.rentAmount >= 0)) {
      return NextResponse.json({ error: "rentAmount must be a number >= 0" }, { status: 400 });
    }
    updates.rentAmount = body.rentAmount;
  }

  // Default amountPaid when marking paid, and set paidAt on first transition to paid
  const currentStatus = (typeof d.status === "string" && isRentPaymentStatus(d.status) ? d.status : "due") as RentPaymentStatus;
  const finalStatus = statusAfter ?? currentStatus;

  // Only treat as a "mark paid" event when transitioning into paid
  if (currentStatus !== "paid" && finalStatus === "paid") {
    if (updates.amountPaid === undefined) {
      const effectiveRent =
        (typeof (updates.rentAmount ?? d.rentAmount) === "number" &&
          Number.isFinite((updates.rentAmount ?? d.rentAmount) as number) &&
          (updates.rentAmount ?? d.rentAmount) >= 0
          ? (updates.rentAmount ?? d.rentAmount)
          : 0) as number;
      updates.amountPaid = effectiveRent;
    }
    if (!d.paidAt) {
      updates.paidAt = FieldValue.serverTimestamp();
    }
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ ok: true });
  }

  await ref.update(updates);
  return NextResponse.json({ ok: true });
}

