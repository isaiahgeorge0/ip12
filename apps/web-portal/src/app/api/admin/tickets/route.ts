import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ticketsCol, propertiesCol, propertyLandlordsCol } from "@/lib/firestore/paths";
import { writeTicketAudit } from "@/lib/audit/ticketAudit";
import { getAllowedAgencyIdsForAdminTickets } from "@/lib/landlordGrants";

function resolveAgencyId(
  session: { role: string; agencyId: string | null },
  body: { agencyId?: string }
): string | null {
  let agencyId = session.agencyId ?? "";
  if (!agencyId && session.role === "superAdmin" && typeof body?.agencyId === "string") {
    agencyId = body.agencyId.trim();
  }
  return agencyId || null;
}

function joinId(agencyId: string, propertyId: string, landlordUid: string): string {
  return `${agencyId}_${propertyId}_${landlordUid}`;
}

/**
 * GET /api/admin/tickets
 * List tickets: for admin, from session.agencyId plus agencies allowed via landlord
 * grant visibility (cross-agency read). superAdmin may pass ?agencyId= to scope to one agency.
 */
export async function GET(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { searchParams } = new URL(request.url);
  const agencyIdParam = searchParams.get("agencyId")?.trim() || null;

  const db = getAdminFirestore();

  // superAdmin with ?agencyId=: single agency
  if (session.role === "superAdmin" && agencyIdParam) {
    const snap = await db.collection(ticketsCol(agencyIdParam)).orderBy("updatedAt", "desc").get();
    const list = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        agencyId: d.agencyId ?? agencyIdParam,
        propertyId: d.propertyId ?? "",
        landlordUid: d.landlordUid ?? "",
        status: typeof d.status === "string" ? d.status : "Open",
        category: typeof d.category === "string" ? d.category : "",
        title: typeof d.title === "string" ? d.title : "",
        description: typeof d.description === "string" ? d.description : "",
        createdAt: d.createdAt ?? null,
        updatedAt: d.updatedAt ?? null,
      };
    });
    return NextResponse.json(list);
  }

  // Admin (or superAdmin without ?agencyId=): need at least one agency
  const sessionAgencyId = session.agencyId ?? "";
  if (!sessionAgencyId && !agencyIdParam) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const allowedAgencyIds =
    session.role === "superAdmin" && agencyIdParam
      ? [agencyIdParam]
      : await getAllowedAgencyIdsForAdminTickets(db, session);

  if (allowedAgencyIds === null) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }
  if (allowedAgencyIds.length === 0) {
    return NextResponse.json([]);
  }

  // Cap to avoid too many collection reads
  const agenciesToQuery = allowedAgencyIds.slice(0, 20);
  const snaps = await Promise.all(
    agenciesToQuery.map((aid) =>
      db.collection(ticketsCol(aid)).orderBy("updatedAt", "desc").get()
    )
  );

  const list: {
    id: string;
    agencyId: string;
    propertyId: string;
    landlordUid: string;
    status: string;
    category: string;
    title: string;
    description: string;
    createdAt: unknown;
    updatedAt: unknown;
  }[] = [];
  snaps.forEach((snap, idx) => {
    const aid = agenciesToQuery[idx];
    snap.docs.forEach((doc) => {
      const d = doc.data();
      list.push({
        id: doc.id,
        agencyId: d.agencyId ?? aid,
        propertyId: d.propertyId ?? "",
        landlordUid: d.landlordUid ?? "",
        status: typeof d.status === "string" ? d.status : "Open",
        category: typeof d.category === "string" ? d.category : "",
        title: typeof d.title === "string" ? d.title : "",
        description: typeof d.description === "string" ? d.description : "",
        createdAt: d.createdAt ?? null,
        updatedAt: d.updatedAt ?? null,
      });
    });
  });

  list.sort((a, b) => {
    const aVal = (a.updatedAt as { seconds?: number })?.seconds ?? 0;
    const bVal = (b.updatedAt as { seconds?: number })?.seconds ?? 0;
    return bVal - aVal;
  });

  return NextResponse.json(list);
}

/**
 * POST /api/admin/tickets
 * Create a ticket. admin: agencyId = session.agencyId. superAdmin: can pass agencyId in body.
 * Body: propertyId (required), landlordUid (optional), category, title, description.
 * If landlordUid provided, requires propertyLandlords join doc for (agencyId, propertyId, landlordUid).
 */
export async function POST(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  let body: {
    agencyId?: string;
    propertyId?: string;
    landlordUid?: string;
    category?: string;
    title?: string;
    description?: string;
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
  const landlordUid = typeof body?.landlordUid === "string" ? body.landlordUid.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "General";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  if (!propertyId) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const db = getAdminFirestore();

  const propRef = db.doc(`${propertiesCol(agencyId)}/${propertyId}`);
  const propSnap = await propRef.get();
  if (!propSnap.exists) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  if (landlordUid) {
    const joinRef = db.collection(propertyLandlordsCol()).doc(joinId(agencyId, propertyId, landlordUid));
    const joinSnap = await joinRef.get();
    if (!joinSnap.exists) {
      return NextResponse.json(
        { error: "Landlord is not assigned to this property" },
        { status: 400 }
      );
    }
  }

  const col = db.collection(ticketsCol(agencyId));
  const ref = await col.add({
    agencyId,
    propertyId,
    landlordUid: landlordUid || "",
    status: "Open",
    category: category || "General",
    title,
    description,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  writeTicketAudit({
    action: "TICKET_CREATED",
    actorUid: session.uid,
    actorAgencyId: session.agencyId,
    role: session.role,
    ticketId: ref.id,
    agencyId,
    propertyId,
    landlordUid: landlordUid || "",
    status: "Open",
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("[admin/tickets] created:", ref.id);
  }

  return NextResponse.json({
    ok: true,
    id: ref.id,
    agencyId,
    propertyId,
    landlordUid: landlordUid || "",
    status: "Open",
    category: category || "General",
    title,
    description,
  });
}
