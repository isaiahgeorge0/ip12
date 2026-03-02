import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getServerSession } from "@/lib/auth/serverSession";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ticketsCol } from "@/lib/firestore/paths";
import { writeTicketAudit } from "@/lib/audit/ticketAudit";

const ADMIN_ROLES = ["admin", "superAdmin"] as const;
const ALLOWED_STATUSES = ["Open", "In progress", "Resolved"] as const;

function isAdmin(role: string): boolean {
  return ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
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
  const session = await getServerSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
