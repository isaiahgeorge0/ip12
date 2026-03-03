import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/serverSession";
import type { Role } from "@/lib/types/roles";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertyLandlordsCol, userDoc } from "@/lib/firestore/paths";
import { writePropertyLandlordAudit } from "@/lib/audit/propertyLandlordAudit";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

const ADMIN_ROLES = ["admin", "superAdmin"] as const;

function isAdmin(role: Role): role is (typeof ADMIN_ROLES)[number] {
  return ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
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
 * DELETE /api/admin/property-landlords/[joinId]
 * Deletes propertyLandlords/{joinId}. Optional body: { agencyId, propertyId, landlordUid } for legacy fallback.
 * Rule: normal admin can unassign only when join's agencyId === landlord.primaryAgencyId; superAdmin can always unassign.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ joinId: string }> }
) {
  const session = await getServerSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { joinId } = await params;
  if (!joinId) {
    return NextResponse.json({ error: "joinId required" }, { status: 400 });
  }

  let fallback: { agencyId?: string; propertyId?: string; landlordUid?: string } = {};
  try {
    const body = await request.json();
    if (body && typeof body === "object") {
      fallback = {
        agencyId: typeof body.agencyId === "string" ? body.agencyId.trim() : undefined,
        propertyId: typeof body.propertyId === "string" ? body.propertyId.trim() : undefined,
        landlordUid: typeof body.landlordUid === "string" ? body.landlordUid.trim() : undefined,
      };
    }
  } catch {
    // no body is ok
  }

  const db = getAdminFirestore();
  const col = db.collection(propertyLandlordsCol());
  const ref = col.doc(joinId);
  const existing = await ref.get();

  if (existing.exists) {
    const d = existing.data()!;
    const joinAgencyId = typeof d.agencyId === "string" ? d.agencyId : "";
    const joinLandlordUid = typeof d.landlordUid === "string" ? d.landlordUid : "";
    let landlordPrimaryAgencyId: string | null = null;
    if (joinLandlordUid) {
      const landlordSnap = await db.doc(userDoc(joinLandlordUid)).get();
      landlordPrimaryAgencyId = getLandlordPrimaryAgencyId(landlordSnap.data());
      if (landlordPrimaryAgencyId == null) {
        return NextResponse.json(
          { error: "Landlord has no primary agency set" },
          { status: 400 }
        );
      }
      if (session.role !== "superAdmin" && joinAgencyId !== landlordPrimaryAgencyId) {
        writeAuditLog({
          action: "MUTATION_DENIED_PRIMARY_ONLY",
          actorUid: session.uid,
          actorRole: "admin",
          actorAgencyId: session.agencyId,
          targetType: "assignment",
          targetId: joinId,
          agencyId: joinAgencyId,
          meta: { propertyId: typeof d.propertyId === "string" ? d.propertyId : "", landlordUid: joinLandlordUid, actingAgencyId: joinAgencyId, landlordPrimaryAgencyId, statusCode: 403 },
          bypass: false,
        });
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[property-landlords DELETE] mutation denied: join agency is not landlord primary",
            { landlordUid: joinLandlordUid, joinAgencyId, landlordPrimaryAgencyId }
          );
        }
        return NextResponse.json(
          { error: "Only primary agency can assign/unassign this landlord" },
          { status: 403 }
        );
      }
    }
    await ref.delete();
    const joinPropertyId = typeof d.propertyId === "string" ? d.propertyId : "";
    writePropertyLandlordAudit({
      action: "PROPERTY_LANDLORD_UNASSIGNED",
      actorUid: session.uid,
      actorRole: session.role,
      actorAgencyId: session.agencyId,
      landlordUid: joinLandlordUid,
      propertyId: joinPropertyId,
      agencyId: joinAgencyId,
      ...(session.role === "superAdmin" && {
        landlordPrimaryAgencyId: landlordPrimaryAgencyId ?? undefined,
        targetAgencyId: joinAgencyId,
      }),
    });
    if (process.env.NODE_ENV !== "production") {
      console.info("[property-landlords DELETE] success:", joinId);
    }
    return NextResponse.json({ ok: true });
  }

  const { agencyId, propertyId, landlordUid } = fallback;
  if (agencyId && propertyId && landlordUid) {
    const landlordSnap = await db.doc(userDoc(landlordUid)).get();
    const landlordPrimaryAgencyId = getLandlordPrimaryAgencyId(landlordSnap.data());
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
        targetId: `${agencyId}_${propertyId}_${landlordUid}`,
        agencyId,
        meta: { propertyId, landlordUid, actingAgencyId: agencyId, landlordPrimaryAgencyId, statusCode: 403 },
        bypass: false,
      });
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[property-landlords DELETE] mutation denied: fallback agency is not landlord primary",
          { landlordUid, agencyId, landlordPrimaryAgencyId }
        );
      }
      return NextResponse.json(
        { error: "Only primary agency can assign/unassign this landlord" },
        { status: 403 }
      );
    }
    const legacy = await col
      .where("agencyId", "==", agencyId)
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
        agencyId,
        ...(session.role === "superAdmin" && {
          landlordPrimaryAgencyId: landlordPrimaryAgencyId ?? undefined,
          targetAgencyId: agencyId,
        }),
      });
      if (process.env.NODE_ENV !== "production") {
        console.warn("[property-landlords DELETE] legacy join doc cleaned up:", legDoc.id);
      }
      return NextResponse.json({ ok: true });
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[property-landlords DELETE] not found:", joinId);
  }
  return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
}
