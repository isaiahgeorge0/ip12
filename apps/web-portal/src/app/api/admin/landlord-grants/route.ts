import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  landlordAgencyGrantsCol,
  landlordAgencyGrantDoc,
  userDoc,
} from "@/lib/firestore/paths";
import { canAdminViewLandlord } from "@/lib/landlordGrants";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

/**
 * GET /api/admin/landlord-grants?landlordUid=...
 * Returns grant for the landlord. Allowed: superAdmin or admin with access (member OR grant).
 */
export async function GET(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { searchParams } = new URL(request.url);
  const landlordUid = searchParams.get("landlordUid")?.trim();
  if (!landlordUid) {
    return NextResponse.json({ error: "landlordUid required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  if (session.role !== "superAdmin") {
    const access = await canAdminViewLandlord(db, session, landlordUid);
    if (!access.ok) {
      return NextResponse.json({ error: "Forbidden: no access to this landlord" }, { status: 403 });
    }
  }

  const grantRef = db.doc(landlordAgencyGrantDoc(landlordUid));
  const snap = await grantRef.get();
  if (!snap.exists) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[landlord-grants] no grant doc for landlord:", landlordUid);
    }
    return NextResponse.json({
      landlordUid,
      sharedWithAgencyIds: [],
      updatedAt: null,
      updatedByUid: null,
    });
  }

  const d = snap.data()!;
  const sharedWithAgencyIds = Array.isArray(d.sharedWithAgencyIds)
    ? (d.sharedWithAgencyIds as string[]).filter((x) => typeof x === "string")
    : [];
  return NextResponse.json({
    landlordUid,
    sharedWithAgencyIds,
    updatedAt: d.updatedAt ?? null,
    updatedByUid: typeof d.updatedByUid === "string" ? d.updatedByUid : null,
  });
}

/**
 * POST /api/admin/landlord-grants
 * Body: { landlordUid: string, sharedWithAgencyIds: string[] }. Upserts grant. superAdmin only.
 */
export async function POST(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["superAdmin"]);
  if (role403) return role403;

  let body: { landlordUid?: string; sharedWithAgencyIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const landlordUid = typeof body?.landlordUid === "string" ? body.landlordUid.trim() : "";
  if (!landlordUid) {
    return NextResponse.json({ error: "landlordUid required" }, { status: 400 });
  }
  const sharedWithAgencyIds = Array.isArray(body?.sharedWithAgencyIds)
    ? (body.sharedWithAgencyIds as string[]).filter((x) => typeof x === "string")
    : [];

  const db = getAdminFirestore();
  const userSnap = await db.doc(userDoc(landlordUid)).get();
  if (!userSnap.exists) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[landlord-grants] landlord doc not found:", landlordUid);
    }
    return NextResponse.json({ error: "Landlord not found" }, { status: 404 });
  }

  const grantRef = db.doc(landlordAgencyGrantDoc(landlordUid));
  const existingSnap = await grantRef.get();
  const before = existingSnap.exists
    ? (Array.isArray((existingSnap.data() as { sharedWithAgencyIds?: string[] })?.sharedWithAgencyIds)
        ? (existingSnap.data() as { sharedWithAgencyIds: string[] }).sharedWithAgencyIds.filter((x) => typeof x === "string")
        : [])
    : [];

  await grantRef.set(
    {
      landlordUid,
      sharedWithAgencyIds,
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: session.uid,
    },
    { merge: true }
  );

  writeAuditLog({
    action: "CROSS_AGENCY_VISIBILITY_UPDATED",
    actorUid: session.uid,
    actorRole: "superAdmin",
    actorAgencyId: session.agencyId,
    targetType: "landlord",
    targetId: landlordUid,
    agencyId: null,
    meta: { before, after: sharedWithAgencyIds },
    bypass: true,
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("[landlord-grants] upserted for", landlordUid);
  }
  return NextResponse.json({
    ok: true,
    landlordUid,
    sharedWithAgencyIds,
  });
}
