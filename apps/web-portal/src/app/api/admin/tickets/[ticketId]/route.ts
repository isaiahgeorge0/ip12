import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ticketsCol, propertiesCol } from "@/lib/firestore/paths";
import { writeTicketAudit } from "@/lib/audit/ticketAudit";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";
import { serializeTimestamp } from "@/lib/serialization";

const ALLOWED_STATUSES = ["Open", "In progress", "Resolved"] as const;

function resolveAgencyId(
  session: { role: string; agencyId: string | null },
  request: NextRequest
): string | null {
  let agencyId = session.agencyId ?? "";
  if (!agencyId && session.role === "superAdmin") {
    const q = request.nextUrl.searchParams.get("agencyId");
    if (typeof q === "string" && q.trim()) agencyId = q.trim();
  }
  return agencyId || null;
}

/**
 * GET /api/admin/tickets/[ticketId]
 * Returns a single ticket. superAdmin may pass ?agencyId=.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
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

  const { ticketId } = await params;
  if (!ticketId) {
    return NextResponse.json({ error: "ticketId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.collection(ticketsCol(agencyId)).doc(ticketId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const d = snap.data()!;
  const propertyId = typeof d.propertyId === "string" ? d.propertyId : "";
  let propertyDisplayLabelResolved = propertyId ? `Property ${propertyId}` : "";
  if (propertyId) {
    const propSnap = await db.doc(`${propertiesCol(agencyId)}/${propertyId}`).get();
    if (propSnap.exists && propSnap.data()) {
      propertyDisplayLabelResolved = propertyDisplayLabel(propSnap.data() as Record<string, unknown>, propertyId);
    }
  }

  return NextResponse.json({
    id: snap.id,
    agencyId,
    propertyId,
    propertyDisplayLabel: propertyDisplayLabelResolved,
    landlordUid: typeof d.landlordUid === "string" ? d.landlordUid : "",
    status: typeof d.status === "string" ? d.status : "Open",
    category: typeof d.category === "string" ? d.category : "General",
    title: typeof d.title === "string" ? d.title : "",
    description: typeof d.description === "string" ? d.description : "",
    createdAt: serializeTimestamp(d.createdAt) ?? null,
    updatedAt: serializeTimestamp(d.updatedAt) ?? null,
    createdByUid: typeof d.createdByUid === "string" ? d.createdByUid : "",
  });
}

/**
 * PATCH /api/admin/tickets/[ticketId]
 * Body: { status: string; agencyId?: string }. Update ticket status. agencyId required for superAdmin if no session.agencyId.
 * Writes audit log for status change.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { ticketId } = await params;
  if (!ticketId) {
    return NextResponse.json({ error: "ticketId required" }, { status: 400 });
  }

  let body: { status?: string; agencyId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = typeof body?.status === "string" ? body.status.trim() : "";
  if (!status || !ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
    return NextResponse.json(
      { error: "status must be one of: Open, In progress, Resolved" },
      { status: 400 }
    );
  }

  let agencyId = session.agencyId ?? "";
  if (!agencyId && session.role === "superAdmin" && typeof body?.agencyId === "string") {
    agencyId = body.agencyId.trim();
  }
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.collection(ticketsCol(agencyId)).doc(ticketId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const d = snap.data()!;
  const statusBefore = typeof d.status === "string" ? d.status : "Open";
  const propertyId = typeof d.propertyId === "string" ? d.propertyId : "";
  const landlordUid = typeof d.landlordUid === "string" ? d.landlordUid : "";

  if (statusBefore === status) {
    return NextResponse.json({ ok: true });
  }

  await ref.update({
    status,
    updatedAt: FieldValue.serverTimestamp(),
  });

  writeTicketAudit({
    action: "TICKET_STATUS_CHANGED",
    actorUid: session.uid,
    actorAgencyId: session.agencyId,
    role: session.role,
    ticketId,
    agencyId,
    propertyId,
    landlordUid,
    statusBefore,
    statusAfter: status,
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("[admin/tickets] status updated:", ticketId, status);
  }
  return NextResponse.json({ ok: true, status });
}
