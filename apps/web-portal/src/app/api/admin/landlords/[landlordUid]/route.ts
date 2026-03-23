import { NextRequest, NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { userDoc, landlordAgencyGrantDoc } from "@/lib/firestore/paths";
import { canAdminViewLandlord } from "@/lib/landlordGrants";

/**
 * GET /api/admin/landlords/[landlordUid]
 * Returns landlord profile for detail page. Allowed: superAdmin or admin with access (member OR grant).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ landlordUid: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { landlordUid } = await params;
  if (!landlordUid) {
    return NextResponse.json({ error: "landlordUid required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const access = await canAdminViewLandlord(db, session, landlordUid);
  if (!access.ok) {
    return NextResponse.json({ error: "Forbidden: no access to this landlord" }, { status: 403 });
  }

  const snap = await db.doc(userDoc(landlordUid)).get();
  if (!snap.exists) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[admin/landlords] landlord doc not found:", landlordUid);
    }
    return NextResponse.json({ error: "Landlord not found" }, { status: 404 });
  }

  const d = snap.data()!;
  const agencyIds = Array.isArray(d.agencyIds) ? (d.agencyIds as string[]).filter((x) => typeof x === "string") : [];
  const legacy = d.agencyId != null && typeof d.agencyId === "string" ? d.agencyId : null;
  const primary =
    typeof d.primaryAgencyId === "string" && d.primaryAgencyId.trim() ? d.primaryAgencyId.trim() : null;
  return NextResponse.json({
    uid: landlordUid,
    email: typeof d.email === "string" ? d.email : "",
    displayName: typeof d.displayName === "string" ? d.displayName : "",
    status: typeof d.status === "string" ? d.status : "active",
    agencyIds,
    primaryAgencyId: primary ?? agencyIds[0] ?? legacy ?? null,
    agencyId: primary ?? agencyIds[0] ?? legacy ?? null,
  });
}

/**
 * PATCH /api/admin/landlords/[landlordUid]
 * Body: { agencyIds: string[], primaryAgencyId?: string | null }. superAdmin only.
 * Enforces at least one agencyId. primaryAgencyId must be in agencyIds if set.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ landlordUid: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["superAdmin"]);
  if (role403) return role403;

  const { landlordUid } = await params;
  if (!landlordUid) {
    return NextResponse.json({ error: "landlordUid required" }, { status: 400 });
  }

  let body: { agencyIds?: string[]; primaryAgencyId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const agencyIds = Array.isArray(body?.agencyIds)
    ? (body.agencyIds as string[]).filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim())
    : [];
  if (agencyIds.length === 0) {
    return NextResponse.json(
      { error: "At least one agency is required (agencyIds cannot be empty)" },
      { status: 400 }
    );
  }

  const primaryAgencyId =
    body.primaryAgencyId != null && typeof body.primaryAgencyId === "string"
      ? body.primaryAgencyId.trim() || null
      : null;
  if (primaryAgencyId != null && primaryAgencyId !== "" && !agencyIds.includes(primaryAgencyId)) {
    return NextResponse.json(
      { error: "primaryAgencyId must be one of the agencyIds" },
      { status: 400 }
    );
  }

  const db = getAdminFirestore();
  const userRef = db.doc(userDoc(landlordUid));
  const snap = await userRef.get();
  if (!snap.exists) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[admin/landlords PATCH] landlord doc not found:", landlordUid);
    }
    return NextResponse.json({ error: "Landlord not found" }, { status: 404 });
  }

  const d = snap.data()!;
  if (d.role !== "landlord") {
    return NextResponse.json({ error: "Only landlord profiles can be updated" }, { status: 400 });
  }

  const { FieldValue } = await import("firebase-admin/firestore");
  const update: Record<string, unknown> = {
    agencyIds,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (primaryAgencyId != null && primaryAgencyId !== "") {
    update.primaryAgencyId = primaryAgencyId;
  } else {
    update.primaryAgencyId = null;
  }
  await userRef.set(update, { merge: true });

  if (process.env.NODE_ENV !== "production") {
    console.info("[admin/landlords PATCH] updated agency membership for", landlordUid);
  }
  return NextResponse.json({
    ok: true,
    agencyIds,
    primaryAgencyId: update.primaryAgencyId ?? null,
  });
}
