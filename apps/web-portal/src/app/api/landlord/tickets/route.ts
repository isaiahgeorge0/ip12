import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getServerSession } from "@/lib/auth/serverSession";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertyLandlordsCol, ticketsCol, userDoc } from "@/lib/firestore/paths";
import { writeTicketAudit } from "@/lib/audit/ticketAudit";

const LANDLORD_ROLES = ["landlord", "superAdmin"] as const;

function joinId(agencyId: string, propertyId: string, landlordUid: string): string {
  return `${agencyId}_${propertyId}_${landlordUid}`;
}

/** GET /api/landlord/tickets - list tickets for landlord's assigned properties (all their agencies). */
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!LANDLORD_ROLES.includes(session.role as (typeof LANDLORD_ROLES)[number])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getAdminFirestore();
  const landlordUid = session.uid;

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
  if (agencyIds.length === 0) {
    return NextResponse.json([]);
  }

  const all: { id: string; agencyId: string; data: Record<string, unknown> }[] = [];
  await Promise.all(
    agencyIds.map(async (agencyId) => {
      const snap = await db
        .collection(ticketsCol(agencyId))
        .where("landlordUid", "==", landlordUid)
        .get();
      snap.docs.forEach((doc) => {
        all.push({ id: doc.id, agencyId, data: { id: doc.id, ...doc.data() } });
      });
    })
  );

  const list = all.map(({ id, agencyId, data: d }) => ({
    id,
    agencyId,
    propertyId: d.propertyId ?? "",
    landlordUid: d.landlordUid ?? "",
    status: typeof d.status === "string" ? d.status : "Open",
    category: typeof d.category === "string" ? d.category : "",
    title: typeof d.title === "string" ? d.title : "",
    description: typeof d.description === "string" ? d.description : "",
    createdAt: d.createdAt ?? null,
    updatedAt: d.updatedAt ?? null,
  }));

  list.sort((a, b) => {
    const aSec = a.updatedAt && typeof (a.updatedAt as { seconds?: number }).seconds === "number" ? (a.updatedAt as { seconds: number }).seconds : 0;
    const bSec = b.updatedAt && typeof (b.updatedAt as { seconds?: number }).seconds === "number" ? (b.updatedAt as { seconds: number }).seconds : 0;
    return bSec - aSec;
  });

  return NextResponse.json(list);
}

/** POST /api/landlord/tickets - create ticket for an assigned property. */
export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!LANDLORD_ROLES.includes(session.role as (typeof LANDLORD_ROLES)[number])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { agencyId?: string; propertyId?: string; category?: string; title?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const agencyId = typeof body?.agencyId === "string" ? body.agencyId.trim() : "";
  const propertyId = typeof body?.propertyId === "string" ? body.propertyId.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  if (!agencyId || !propertyId || !title) {
    return NextResponse.json(
      { error: "agencyId, propertyId, and title are required" },
      { status: 400 }
    );
  }

  const landlordUid = session.uid;
  const db = getAdminFirestore();

  const joinRef = db.collection(propertyLandlordsCol()).doc(joinId(agencyId, propertyId, landlordUid));
  const joinSnap = await joinRef.get();
  if (!joinSnap.exists) {
    return NextResponse.json(
      { error: "You are not assigned to this property" },
      { status: 403 }
    );
  }

  const col = db.collection(ticketsCol(agencyId));
  const ref = await col.add({
    agencyId,
    propertyId,
    landlordUid,
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
    landlordUid,
    status: "Open",
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("[landlord/tickets] created:", ref.id);
  }
  return NextResponse.json({ ok: true, id: ref.id });
}
