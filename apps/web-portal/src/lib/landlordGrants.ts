/**
 * Server-only: compute allowedAgencyIds for an admin viewing a landlord's inventory.
 * Used when fetching propertyLandlords + properties for a landlord in admin context.
 */

import type { ServerSessionProfile } from "@/lib/auth/serverSession";
import { landlordAgencyGrantDoc, landlordAgencyGrantsCol, propertyLandlordsCol, userDoc } from "@/lib/firestore/paths";

type Firestore = Awaited<ReturnType<typeof import("@/lib/firebase/admin").getAdminFirestore>>;

/**
 * Shared rule: can an admin view this landlord (detail, inventory, grants)?
 * ok: true when session.role === 'superAdmin' OR landlord.agencyIds includes session.agencyId
 *     OR grant.sharedWithAgencyIds includes session.agencyId.
 * Used by GET landlords/[landlordUid], GET landlord-grants, and property view-access.
 */
export async function canAdminViewLandlord(
  db: Firestore,
  session: ServerSessionProfile,
  landlordUid: string
): Promise<{ ok: boolean; reason?: string }> {
  if (session.role === "superAdmin") return { ok: true };
  const aid = session.agencyId ?? "";
  if (!aid) return { ok: false, reason: "No agencyId" };
  const [userSnap, grantSnap] = await Promise.all([
    db.doc(userDoc(landlordUid)).get(),
    db.doc(landlordAgencyGrantDoc(landlordUid)).get(),
  ]);
  if (userSnap.exists) {
    const d = userSnap.data()!;
    const agencyIds = Array.isArray(d.agencyIds) ? (d.agencyIds as string[]).filter((x) => typeof x === "string") : [];
    const legacy = d.agencyId != null && typeof d.agencyId === "string" ? d.agencyId : null;
    if (agencyIds.includes(aid) || legacy === aid) return { ok: true };
  }
  if (grantSnap.exists) {
    const g = grantSnap.data()!;
    const shared = Array.isArray(g.sharedWithAgencyIds) ? (g.sharedWithAgencyIds as string[]).filter((x) => typeof x === "string") : [];
    if (shared.includes(aid)) return { ok: true };
  }
  return { ok: false, reason: "No access to this landlord" };
}

/**
 * Check if the property is in the landlord's inventory for the given agency (propertyLandlords join exists).
 */
export async function isPropertyInLandlordInventory(
  db: Firestore,
  agencyId: string,
  propertyId: string,
  landlordUid: string
): Promise<boolean> {
  const joinId = `${agencyId}_${propertyId}_${landlordUid}`;
  const ref = db.collection(propertyLandlordsCol()).doc(joinId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const d = snap.data();
  return d?.status !== "removed";
}

/**
 * Returns agency ids the current session is allowed to see for this landlord's inventory.
 * - superAdmin: returns null meaning "no restriction" (all agencies).
 * - Else: [session.agencyId]. If grant exists and session.agencyId is in grant.sharedWithAgencyIds,
 *   returns union(session.agencyId, landlordProfile.agencyIds).
 */
export async function getAllowedAgencyIdsForLandlord(
  db: Firestore,
  session: ServerSessionProfile,
  landlordUid: string
): Promise<string[] | null> {
  if (session.role === "superAdmin") return null;

  const sessionAgencyId = session.agencyId ?? "";
  if (!sessionAgencyId) return [];

  const [userSnap, grantSnap] = await Promise.all([
    db.doc(userDoc(landlordUid)).get(),
    db.doc(landlordAgencyGrantDoc(landlordUid)).get(),
  ]);

  if (!userSnap.exists) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[getAllowedAgencyIdsForLandlord] landlord doc not found:", landlordUid);
    }
    return [sessionAgencyId];
  }

  const userData = userSnap.data()!;
  const landlordAgencyIds = Array.isArray(userData.agencyIds)
    ? (userData.agencyIds as string[]).filter((x) => typeof x === "string")
    : userData.agencyId != null && typeof userData.agencyId === "string"
      ? [userData.agencyId]
      : [];

  if (!grantSnap.exists) {
    return [sessionAgencyId];
  }

  const grantData = grantSnap.data()!;
  const sharedWith = Array.isArray(grantData.sharedWithAgencyIds)
    ? (grantData.sharedWithAgencyIds as string[]).filter((x) => typeof x === "string")
    : [];
  if (!sharedWith.includes(sessionAgencyId)) {
    return [sessionAgencyId];
  }

  const union = new Set<string>([sessionAgencyId, ...landlordAgencyIds]);
  return Array.from(union);
}

/**
 * Returns agency IDs the admin can list tickets for (read).
 * - superAdmin: returns null (caller should use ?agencyId= or require one).
 * - Else: [session.agencyId] plus every agency from landlords that are visible to this admin
 *   via grant (sharedWithAgencyIds contains session.agencyId). Used by GET /api/admin/tickets.
 */
export async function getAllowedAgencyIdsForAdminTickets(
  db: Firestore,
  session: ServerSessionProfile
): Promise<string[] | null> {
  if (session.role === "superAdmin") return null;

  const sessionAgencyId = session.agencyId ?? "";
  if (!sessionAgencyId) return [];

  const grantsSnap = await db
    .collection(landlordAgencyGrantsCol())
    .where("sharedWithAgencyIds", "array-contains", sessionAgencyId)
    .get();

  const allowed = new Set<string>([sessionAgencyId]);
  if (grantsSnap.empty) return Array.from(allowed);

  const landlordUids = grantsSnap.docs.map((d) => d.id);
  const BATCH = 10;
  for (let i = 0; i < landlordUids.length; i += BATCH) {
    const chunk = landlordUids.slice(i, i + BATCH);
    const refs = chunk.map((uid) => db.doc(userDoc(uid)));
    const snaps = await db.getAll(...refs);
    snaps.forEach((snap) => {
      if (!snap.exists) return;
      const d = snap.data()!;
      if (d.role !== "landlord") return;
      const ids = Array.isArray(d.agencyIds)
        ? (d.agencyIds as string[]).filter((x) => typeof x === "string")
        : d.agencyId != null && typeof d.agencyId === "string"
          ? [d.agencyId]
          : [];
      ids.forEach((id) => allowed.add(id));
    });
  }
  return Array.from(allowed);
}
