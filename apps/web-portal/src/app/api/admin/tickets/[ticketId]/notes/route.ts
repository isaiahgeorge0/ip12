import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ticketsCol, ticketNotesCol, userDoc } from "@/lib/firestore/paths";
import { writeTicketAudit } from "@/lib/audit/ticketAudit";

const TEXT_MIN = 1;
const TEXT_MAX = 2000;

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
 * GET /api/admin/tickets/[ticketId]/notes
 * Returns notes ordered by createdAt asc. Same access as ticket: session.agencyId (or superAdmin ?agencyId).
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
  const ticketRef = db.collection(ticketsCol(agencyId)).doc(ticketId);
  const ticketSnap = await ticketRef.get();
  if (!ticketSnap.exists) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const notesSnap = await db
    .collection(ticketNotesCol(agencyId, ticketId))
    .orderBy("createdAt", "asc")
    .get();

  const notes = notesSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      text: typeof d.text === "string" ? d.text : "",
      createdAt: d.createdAt ?? null,
      authorUid: typeof d.authorUid === "string" ? d.authorUid : "",
      authorRole: typeof d.authorRole === "string" ? d.authorRole : "",
      authorAgencyId: typeof d.authorAgencyId === "string" ? d.authorAgencyId : null,
      authorDisplay: typeof d.authorDisplay === "string" ? d.authorDisplay : null,
    };
  });

  return NextResponse.json(notes);
}

/**
 * POST /api/admin/tickets/[ticketId]/notes
 * Body: { text: string }. Validate length 1..2000, trim. Updates ticket.updatedAt and writes audit.
 */
export async function POST(
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

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = typeof body?.text === "string" ? body.text : "";
  const text = raw.trim();
  if (text.length < TEXT_MIN || text.length > TEXT_MAX) {
    return NextResponse.json(
      { error: `Note text must be between ${TEXT_MIN} and ${TEXT_MAX} characters` },
      { status: 400 }
    );
  }

  const db = getAdminFirestore();
  const ticketRef = db.collection(ticketsCol(agencyId)).doc(ticketId);
  const ticketSnap = await ticketRef.get();
  if (!ticketSnap.exists) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const ticketData = ticketSnap.data()!;
  const propertyId = typeof ticketData.propertyId === "string" ? ticketData.propertyId : "";
  const landlordUid = typeof ticketData.landlordUid === "string" ? ticketData.landlordUid : "";
  const status = typeof ticketData.status === "string" ? ticketData.status : "Open";

  let authorDisplay: string | null = null;
  try {
    const userSnap = await db.doc(userDoc(session.uid)).get();
    const u = userSnap.data();
    if (u) {
      const email = typeof u.email === "string" ? u.email : "";
      const displayName = typeof u.displayName === "string" ? u.displayName : "";
      authorDisplay = displayName || email || null;
    }
  } catch {
    // optional
  }

  const notesCol = db.collection(ticketNotesCol(agencyId, ticketId));
  const noteRef = await notesCol.add({
    text,
    createdAt: FieldValue.serverTimestamp(),
    authorUid: session.uid,
    authorRole: session.role,
    authorAgencyId: session.agencyId ?? null,
    authorDisplay,
  });

  await ticketRef.update({ updatedAt: FieldValue.serverTimestamp() });

  writeTicketAudit({
    action: "TICKET_NOTE_ADDED",
    actorUid: session.uid,
    actorAgencyId: session.agencyId,
    role: session.role,
    ticketId,
    agencyId,
    propertyId,
    landlordUid,
    status,
    noteId: noteRef.id,
    noteTextLength: text.length,
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("[admin/tickets/notes] added:", ticketId, noteRef.id);
  }

  return NextResponse.json({
    ok: true,
    id: noteRef.id,
    text,
    createdAt: null,
    authorUid: session.uid,
    authorRole: session.role,
    authorAgencyId: session.agencyId ?? null,
    authorDisplay,
  });
}
