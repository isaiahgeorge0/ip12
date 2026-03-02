/**
 * Server-only: read and verify Firebase session cookie, load user profile from Firestore.
 * Use in server components and layout route guards (no firebase-admin in edge).
 */

import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { userDoc } from "@/lib/firestore/paths";
import type { UserProfile } from "@/lib/types/userProfile";
import type { Role } from "@/lib/types/roles";

export const SESSION_COOKIE_NAME = "__session";

export type ServerSessionProfile = {
  uid: string;
  role: Role;
  status: UserProfile["status"];
  agencyId: string | null;
  permissions: UserProfile["permissions"];
  email: string;
};

/**
 * Reads __session cookie, verifies with Firebase Admin, loads profile from Firestore.
 * Returns null if missing/invalid cookie or profile not found/invalid.
 */
export async function getServerSession(): Promise<ServerSessionProfile | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid;
    if (!uid) return null;

    const db = getAdminFirestore();
    const snap = await db.doc(userDoc(uid)).get();
    if (!snap.exists) return null;

    const d = snap.data();
    if (
      !d ||
      typeof d.uid !== "string" ||
      typeof d.email !== "string" ||
      typeof d.role !== "string" ||
      typeof d.status !== "string" ||
      !Array.isArray(d.permissions)
    ) {
      return null;
    }
    const agencyIds = Array.isArray(d.agencyIds) ? (d.agencyIds as string[]).filter((x) => typeof x === "string") : [];
    const legacyAgencyId = d.agencyId != null && typeof d.agencyId === "string" ? d.agencyId : null;
    const primaryAgencyId =
      typeof d.primaryAgencyId === "string" && d.primaryAgencyId.trim()
        ? d.primaryAgencyId.trim()
        : null;
    const agencyId = primaryAgencyId ?? agencyIds[0] ?? legacyAgencyId;

    let status = d.status as UserProfile["status"];
    if (d.role === "landlord" && status === "pending") {
      await snap.ref.update({
        status: "active",
        updatedAt: FieldValue.serverTimestamp(),
      });
      status = "active";
      if (process.env.NODE_ENV !== "production") {
        console.info("[serverSession] landlord first login, status -> active:", d.uid);
      }
    }

    return {
      uid: d.uid,
      email: d.email,
      role: d.role as Role,
      status,
      agencyId,
      permissions: d.permissions as UserProfile["permissions"],
    };
  } catch {
    return null;
  }
}
