/**
 * Fetch and parse user profile from Firestore.
 * Used after sign-in to authorize and store profile in auth state.
 */

import { getDoc, doc } from "firebase/firestore";
import type { UserProfile } from "@/lib/types/userProfile";
import { userDoc } from "@/lib/firestore/paths";
import { getFirebaseFirestore } from "@/lib/firebase/client";

/** Firestore Timestamp-like from doc snapshot. */
function toTimestamp(
  v: unknown
): { seconds: number; nanoseconds: number } | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && "seconds" in v && typeof (v as { seconds: number }).seconds === "number") {
    const t = v as { seconds: number; nanoseconds?: number };
    return { seconds: t.seconds, nanoseconds: t.nanoseconds ?? 0 };
  }
  return null;
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const db = getFirebaseFirestore();
  if (!db) return null;
  const ref = doc(db, userDoc(uid));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data();
  const createdAt = toTimestamp(d.createdAt);
  const updatedAt = toTimestamp(d.updatedAt);
  if (
    typeof d.uid !== "string" ||
    typeof d.email !== "string" ||
    typeof d.role !== "string" ||
    !Array.isArray(d.permissions) ||
    typeof d.status !== "string" ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }
  const agencyIds = Array.isArray(d.agencyIds) ? (d.agencyIds as string[]).filter((x) => typeof x === "string") : [];
  const legacyAgencyId = d.agencyId != null && typeof d.agencyId === "string" ? d.agencyId : null;
  const primaryAgencyId =
    typeof d.primaryAgencyId === "string" && d.primaryAgencyId.trim() ? d.primaryAgencyId.trim() : null;
  const agencyId = primaryAgencyId ?? agencyIds[0] ?? legacyAgencyId ?? null;

  return {
    uid: d.uid,
    email: d.email,
    role: d.role as UserProfile["role"],
    permissions: d.permissions as UserProfile["permissions"],
    agencyIds: agencyIds.length ? agencyIds : legacyAgencyId ? [legacyAgencyId] : [],
    primaryAgencyId: primaryAgencyId ?? (agencyIds[0] ?? legacyAgencyId) ?? null,
    agencyId,
    status: d.status as UserProfile["status"],
    createdAt,
    updatedAt,
    ...(typeof d.displayName === "string" && { displayName: d.displayName }),
    ...(typeof d.phone === "string" && { phone: d.phone }),
  };
}
