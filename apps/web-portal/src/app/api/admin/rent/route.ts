import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertiesCol, rentPaymentsCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import { normalizedDisplayAddress } from "@/lib/admin/normalizePropertyDisplay";
import {
  RENT_PAYMENT_STATUSES,
  isRentPaymentStatus,
  type RentPaymentStatus,
  type RentPaymentListItem,
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

export async function GET(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { searchParams } = new URL(request.url);
  const agencyIdParam = searchParams.get("agencyId")?.trim() ?? null;
  const statusParam = searchParams.get("status")?.trim() ?? "";
  const tenancyIdParam = searchParams.get("tenancyId")?.trim() ?? "";
  const propertyIdParam = searchParams.get("propertyId")?.trim() ?? "";

  const agencyId = resolveAgencyId(session, { agencyId: agencyIdParam ?? undefined });
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  let query: FirebaseFirestore.Query = db
    .collection(rentPaymentsCol(agencyId))
    .orderBy("dueDate", "desc")
    .limit(500);

  const snap = await query.get();
  let docs = snap.docs;

  if (statusParam && isRentPaymentStatus(statusParam)) {
    docs = docs.filter((d) => (d.data().status as string) === statusParam);
  }
  if (tenancyIdParam) {
    docs = docs.filter((d) => (d.data().tenancyId as string) === tenancyIdParam);
  }
  if (propertyIdParam) {
    docs = docs.filter((d) => (d.data().propertyId as string) === propertyIdParam);
  }

  const today = new Date().toISOString().slice(0, 10);

  const list: RentPaymentListItem[] = docs.map((doc) => {
    const d = doc.data();
    const rawStatus = typeof d.status === "string" && isRentPaymentStatus(d.status) ? (d.status as RentPaymentStatus) : "due";
    const dueDate = typeof d.dueDate === "string" ? d.dueDate : "";

    let effectiveStatus: RentPaymentStatus = rawStatus;
    if (rawStatus === "due" && dueDate && dueDate < today) {
      effectiveStatus = "late";
    }

    return {
      id: doc.id,
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
    tenancyId?: string;
    propertyId?: string;
    tenantName?: string;
    rentAmount?: number;
    dueDate?: string;
    notes?: string | null;
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

  const tenancyId = typeof body?.tenancyId === "string" ? body.tenancyId.trim() : "";
  const propertyId = typeof body?.propertyId === "string" ? body.propertyId.trim() : "";
  const tenantName = typeof body?.tenantName === "string" ? body.tenantName.trim() : "";
  const dueDate = typeof body?.dueDate === "string" ? body.dueDate.trim() : "";

  if (!tenancyId || !propertyId || !tenantName || !dueDate) {
    return NextResponse.json(
      { error: "tenancyId, propertyId, tenantName and dueDate are required" },
      { status: 400 }
    );
  }

  // Basic ISO yyyy-mm-dd check
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return NextResponse.json({ error: "dueDate must be ISO yyyy-mm-dd" }, { status: 400 });
  }

  const rentAmount =
    typeof body?.rentAmount === "number" && Number.isFinite(body.rentAmount) && body.rentAmount >= 0
      ? body.rentAmount
      : NaN;
  if (!Number.isFinite(rentAmount)) {
    return NextResponse.json({ error: "rentAmount must be a number >= 0" }, { status: 400 });
  }

  const notes =
    typeof body?.notes === "string"
      ? body.notes.trim() || null
      : body?.notes === null
        ? null
        : null;

  const db = getAdminFirestore();
  const propRef = db.doc(`${propertiesCol(agencyId)}/${propertyId}`);
  const propSnap = await propRef.get();
  let propertyDisplayLabel: string | null = null;
  if (propSnap.exists) {
    propertyDisplayLabel = normalizedDisplayAddress(propSnap.data() ?? {}, propertyId);
  }

  const now = FieldValue.serverTimestamp();
  const col = db.collection(rentPaymentsCol(agencyId));
  const ref = await col.add({
    agencyId,
    tenancyId,
    propertyId,
    propertyDisplayLabel,
    tenantName,
    rentAmount,
    dueDate,
    status: "due",
    paidAt: null,
    amountPaid: null,
    notes,
    createdAt: now,
    updatedAt: now,
    createdBy: session.uid,
  });

  return NextResponse.json({
    ok: true,
    id: ref.id,
    agencyId,
    tenancyId,
    propertyId,
    status: "due",
  });
}

