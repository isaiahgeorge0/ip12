import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ticketsCol, ticketNotesCol, userDoc } from "@/lib/firestore/paths";
import { writeTicketAudit } from "@/lib/audit/ticketAudit";

const TEXT_MIN = 1;
const TEXT_MAX = 2000;

/** Find ticket doc for this landlord (ticketId in one of landlord's agencies, landlordUid match). Returns ticket meta or null. */
async function findTicketForLandlord(
  db: ReturnType<typeof getAdminFirestore>,
  ticketId: string,
  landlordUid: string
): Promise<{ agencyId: string; propertyId: string; landlordUid: string; status: string } | null> {
  const userSnap = await db.doc(userDoc(landlordUid)).get();
  const agencyIds: string[] = [];
  if (userSnap.exists) {
    const d = userSnap.data()!;
    agencyIds.push(
      ...(Array.isArray(d.agencyIds) ? (d.agencyIds as string[]).filter((x) => typeof x === "string") : [])
    );
    if (agencyIds.length === 0 && d.agencyId != null && typeof d.agencyId === "string") {
      agencyIds.push(d.agencyId);
    }
  }
  for (const agencyId of agencyIds) {
    const ref = db.collection(ticketsCol(agencyId)).doc(ticketId);
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data()!;
      const docLandlordUid = typeof data.landlordUid === "string" ? data.landlordUid : "";
      if (docLandlordUid === landlordUid) {
        return {
          agencyId,
          propertyId: typeof data.propertyId === "string" ? data.propertyId : "",
          landlordUid: docLandlordUid,
          status: typeof data.status === "string" ? data.status : "Open",
        };
      }
    }
  }
  return null;
}

/**
 * GET /api/landlord/tickets/[ticketId]/notes
 * Notes for a ticket that belongs to this landlord (landlordUid === session.uid, ticket in one of landlord's agencies).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["landlord", "superAdmin"]);
  if (role403) return role403;

  const { ticketId } = await params;
  if (!ticketId) {
    return NextResponse.json({ error: "ticketId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const found = await findTicketForLandlord(db, ticketId, session.uid);
  if (!found) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const notesSnap = await db
    .collection(ticketNotesCol(found.agencyId, ticketId))
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
 * POST /api/landlord/tickets/[ticketId]/notes
 * Add note. Same access: ticket must belong to this landlord.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["landlord", "superAdmin"]);
  if (role403) return role403;

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
  const found = await findTicketForLandlord(db, ticketId, session.uid);
  if (!found) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const ticketRef = db.collection(ticketsCol(found.agencyId)).doc(ticketId);

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

  const notesCol = db.collection(ticketNotesCol(found.agencyId, ticketId));
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
    agencyId: found.agencyId,
    propertyId: found.propertyId,
    landlordUid: found.landlordUid,
    status: found.status,
    noteId: noteRef.id,
    noteTextLength: text.length,
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("[landlord/tickets/notes] added:", ticketId, noteRef.id);
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
