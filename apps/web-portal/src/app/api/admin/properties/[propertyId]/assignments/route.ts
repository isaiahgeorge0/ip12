import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/serverSession";
import type { Role } from "@/lib/types/roles";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertyLandlordsCol, userDoc } from "@/lib/firestore/paths";
import { FieldValue } from "firebase-admin/firestore";
import { writePropertyLandlordAudit } from "@/lib/audit/propertyLandlordAudit";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { canAdminViewLandlord, isPropertyInLandlordInventory } from "@/lib/landlordGrants";

const ADMIN_ROLES = ["admin", "superAdmin"] as const;

function isAdmin(role: Role): role is (typeof ADMIN_ROLES)[number] {
  return ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
}

/** Deterministic join doc id: propertyLandlords/{joinId}. */
function joinId(agencyId: string, propertyId: string, landlordUid: string): string {
  return `${agencyId}_${propertyId}_${landlordUid}`;
}

function getLandlordPrimaryAgencyId(d: Record<string, unknown> | undefined): string | null {
  if (!d) return null;
  const primary =
    typeof d.primaryAgencyId === "string" && d.primaryAgencyId.trim()
      ? d.primaryAgencyId.trim()
      : null;
  const agencyIds = Array.isArray(d.agencyIds)
    ? (d.agencyIds as string[]).filter((x) => typeof x === "string")
    : [];
  const legacy = d.agencyId != null && typeof d.agencyId === "string" ? d.agencyId : null;
  return primary ?? agencyIds[0] ?? legacy ?? null;
}

/**
 * GET /api/admin/properties/[propertyId]/assignments
 * Returns assignments for this property. Optional ?agencyId= and ?landlordUid= for cross-agency view:
 * when provided, access allowed if canAdminViewLandlord ok and property in landlord inventory.
 * Otherwise filter by session.agencyId.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const session = await getServerSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { propertyId } = await params;
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const queryAgencyId = searchParams.get("agencyId")?.trim();
  const queryLandlordUid = searchParams.get("landlordUid")?.trim();

  const db = getAdminFirestore();
  const sessionAgencyId = session.agencyId ?? "";

  let filterAgencyId: string | null = sessionAgencyId || null;
  if (queryAgencyId) {
    if (session.role === "superAdmin") {
      filterAgencyId = queryAgencyId;
    } else if (queryAgencyId === sessionAgencyId) {
      filterAgencyId = queryAgencyId;
    } else if (queryLandlordUid) {
      const access = await canAdminViewLandlord(db, session, queryLandlordUid);
      if (access.ok) {
        const inInventory = await isPropertyInLandlordInventory(db, queryAgencyId, propertyId, queryLandlordUid);
        if (inInventory) filterAgencyId = queryAgencyId;
      }
    }
    if (queryAgencyId && filterAgencyId !== queryAgencyId) {
      return NextResponse.json([]);
    }
  }

  const col = db.collection(propertyLandlordsCol());
  const snap = filterAgencyId
    ? await col
        .where("propertyId", "==", propertyId)
        .where("agencyId", "==", filterAgencyId)
        .get()
    : await col.where("propertyId", "==", propertyId).get();

  const rows = snap.docs
    .map((doc) => {
      const d = doc.data();
      const status = d.status ?? "active";
      return {
        id: doc.id,
        landlordUid: d.landlordUid ?? "",
        agencyId: d.agencyId ?? "",
        propertyId: d.propertyId ?? "",
        createdAt: d.createdAt,
        status,
      };
    })
    .filter((r) => r.status !== "removed");

  const list = await Promise.all(
    rows.map(async (r) => {
      const userSnap = await db.doc(userDoc(r.landlordUid)).get();
      const u = userSnap.data();
      const primaryAgencyId = getLandlordPrimaryAgencyId(u);
      return {
        ...r,
        email: typeof u?.email === "string" ? u.email : "",
        displayName: typeof u?.displayName === "string" ? u.displayName : "",
        primaryAgencyId,
      };
    })
  );

  return NextResponse.json(list);
}

/**
 * POST /api/admin/properties/[propertyId]/assignments
 * Body: { landlordUid: string }. Creates join doc; 409 if already assigned (and not removed).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const session = await getServerSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { propertyId } = await params;
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }

  let body: { landlordUid?: string; agencyId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const landlordUid = typeof body?.landlordUid === "string" ? body.landlordUid.trim() : "";
  if (!landlordUid) {
    return NextResponse.json({ error: "landlordUid required" }, { status: 400 });
  }

  let agencyId = session.agencyId ?? "";
  if (!agencyId && session.role === "superAdmin" && typeof body?.agencyId === "string") {
    agencyId = body.agencyId.trim();
  }
  if (!agencyId) {
    return NextResponse.json(
      { error: "Agency required to assign landlords" },
      { status: 400 }
    );
  }

  const db = getAdminFirestore();
  const landlordSnap = await db.doc(userDoc(landlordUid)).get();
  const landlordData = landlordSnap.data();
  const landlordPrimaryAgencyId = getLandlordPrimaryAgencyId(landlordData);
  if (landlordPrimaryAgencyId == null) {
    return NextResponse.json(
      { error: "Landlord has no primary agency set" },
      { status: 400 }
    );
  }
  if (session.role !== "superAdmin" && agencyId !== landlordPrimaryAgencyId) {
    writeAuditLog({
      action: "MUTATION_DENIED_PRIMARY_ONLY",
      actorUid: session.uid,
      actorRole: "admin",
      actorAgencyId: session.agencyId,
      targetType: "assignment",
      targetId: joinId(agencyId, propertyId, landlordUid),
      agencyId,
      meta: { propertyId, landlordUid, actingAgencyId: agencyId, landlordPrimaryAgencyId, statusCode: 403 },
      bypass: false,
    });
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[Assign] mutation denied: session agency is not landlord primary",
        { landlordUid, sessionAgencyId: session.agencyId, landlordPrimaryAgencyId }
      );
    }
    return NextResponse.json(
      { error: "Only primary agency can assign/unassign this landlord" },
      { status: 403 }
    );
  }

  const docId = joinId(agencyId, propertyId, landlordUid);
  const ref = db.collection(propertyLandlordsCol()).doc(docId);
  const existing = await ref.get();

  if (existing.exists) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[Assign] duplicate assignment skipped:", docId);
    }
    return NextResponse.json(
      { error: "Landlord is already assigned to this property" },
      { status: 409 }
    );
  }

  await ref.set({
    agencyId,
    landlordUid,
    propertyId,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Rule: normal admin can only assign when session.agencyId === landlord.primaryAgencyId;
  // superAdmin can assign regardless. Audit records bypass with actorRole and context.
  writePropertyLandlordAudit({
    action: "PROPERTY_LANDLORD_ASSIGNED",
    actorUid: session.uid,
    actorRole: session.role,
    actorAgencyId: session.agencyId,
    landlordUid,
    propertyId,
    agencyId,
    ...(session.role === "superAdmin" && {
      landlordPrimaryAgencyId: landlordPrimaryAgencyId ?? undefined,
      targetAgencyId: agencyId,
    }),
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("[Assign] success:", docId);
  }
  return NextResponse.json({ ok: true, id: docId });
}

/**
 * DELETE /api/admin/properties/[propertyId]/assignments
 * Body: { landlordUid: string; agencyId?: string }. Deletes the join doc by joinId (agencyId_propertyId_landlordUid).
 * Kept for backwards compatibility; client may use DELETE /api/admin/property-landlords/[joinId] instead.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const session = await getServerSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { propertyId } = await params;
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }

  let body: { landlordUid?: string; agencyId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const landlordUid = typeof body?.landlordUid === "string" ? body.landlordUid.trim() : "";
  const agencyId = typeof body?.agencyId === "string" ? body.agencyId.trim() : session.agencyId ?? "";
  if (!landlordUid) {
    return NextResponse.json({ error: "landlordUid required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const landlordSnap = await db.doc(userDoc(landlordUid)).get();
  const landlordData = landlordSnap.data();
  const landlordPrimaryAgencyId = getLandlordPrimaryAgencyId(landlordData);
  if (landlordPrimaryAgencyId == null) {
    return NextResponse.json(
      { error: "Landlord has no primary agency set" },
      { status: 400 }
    );
  }
  const actingAgencyId = (agencyId || session.agencyId) ?? "";
  if (session.role !== "superAdmin" && actingAgencyId !== landlordPrimaryAgencyId) {
    writeAuditLog({
      action: "MUTATION_DENIED_PRIMARY_ONLY",
      actorUid: session.uid,
      actorRole: "admin",
      actorAgencyId: session.agencyId,
      targetType: "assignment",
      targetId: joinId(actingAgencyId, propertyId, landlordUid),
      agencyId: actingAgencyId,
      meta: { propertyId, landlordUid, actingAgencyId, landlordPrimaryAgencyId, statusCode: 403 },
      bypass: false,
    });
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[Unassign] mutation denied: session agency is not landlord primary",
        { landlordUid, sessionAgencyId: session.agencyId, landlordPrimaryAgencyId }
      );
    }
    return NextResponse.json(
      { error: "Only primary agency can assign/unassign this landlord" },
      { status: 403 }
    );
  }

  const col = db.collection(propertyLandlordsCol());
  const docId = joinId(actingAgencyId, propertyId, landlordUid);
  const ref = col.doc(docId);
  let existing = await ref.get();

  if (!existing.exists && actingAgencyId) {
    const legacy = await col
      .where("agencyId", "==", actingAgencyId)
      .where("propertyId", "==", propertyId)
      .where("landlordUid", "==", landlordUid)
      .limit(1)
      .get();
    const legDoc = legacy.docs[0];
    if (legDoc) {
      await legDoc.ref.delete();
      writePropertyLandlordAudit({
        action: "PROPERTY_LANDLORD_UNASSIGNED",
        actorUid: session.uid,
        actorRole: session.role,
        actorAgencyId: session.agencyId,
        landlordUid,
        propertyId,
        agencyId: actingAgencyId,
        ...(session.role === "superAdmin" && {
          landlordPrimaryAgencyId: landlordPrimaryAgencyId ?? undefined,
          targetAgencyId: actingAgencyId,
        }),
      });
      if (process.env.NODE_ENV !== "production") {
        console.warn("[Unassign] legacy join doc cleaned up:", legDoc.id);
      }
      return NextResponse.json({ ok: true });
    }
  }

  if (!existing.exists) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[Unassign] doc not found:", docId);
    }
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  await ref.delete();
  writePropertyLandlordAudit({
    action: "PROPERTY_LANDLORD_UNASSIGNED",
    actorUid: session.uid,
    actorRole: session.role,
    actorAgencyId: session.agencyId,
    landlordUid,
    propertyId,
    agencyId: actingAgencyId,
    ...(session.role === "superAdmin" && {
      landlordPrimaryAgencyId: landlordPrimaryAgencyId ?? undefined,
      targetAgencyId: actingAgencyId,
    }),
  });
  if (process.env.NODE_ENV !== "production") {
    console.info("[Unassign] success:", docId);
  }
  return NextResponse.json({ ok: true });
}
