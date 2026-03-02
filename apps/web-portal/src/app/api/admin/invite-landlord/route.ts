import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { userDoc } from "@/lib/firestore/paths";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["admin", "superAdmin"] as const;

type Body = {
  landlordEmail?: string;
  landlordDisplayName?: string;
  agencyId?: string;
};

/**
 * POST /api/admin/invite-landlord
 * Caller must be admin or superAdmin. Creates Firebase Auth user if needed, writes/updates
 * users/{uid} with role landlord, agencyId, status pending, invitedAt, invitedByUid.
 * Generates password reset link. Status becomes "active" on first login.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const callerUid = decoded.uid;

    const db = getAdminFirestore();
    const callerDoc = await db.doc(userDoc(callerUid)).get();
    const callerData = callerDoc.data();
    const callerRole = callerData?.role as string | undefined;
    if (!callerRole || !ADMIN_ROLES.includes(callerRole as (typeof ADMIN_ROLES)[number])) {
      return NextResponse.json({ error: "Forbidden: admin or superAdmin only" }, { status: 403 });
    }

    const body = (await request.json()) as Body;
    const email = typeof body.landlordEmail === "string" ? body.landlordEmail.trim() : "";
    const displayName =
      typeof body.landlordDisplayName === "string" ? body.landlordDisplayName.trim() : "";
    if (!email || !displayName) {
      return NextResponse.json(
        { error: "landlordEmail and landlordDisplayName are required" },
        { status: 400 }
      );
    }

    const callerAgencyIds = Array.isArray(callerData?.agencyIds) ? (callerData.agencyIds as string[]) : [];
    const callerLegacyAgencyId =
      callerData?.agencyId != null && typeof callerData.agencyId === "string" ? callerData.agencyId : null;
    const callerPrimary =
      typeof callerData?.primaryAgencyId === "string" && callerData.primaryAgencyId.trim()
        ? callerData.primaryAgencyId.trim()
        : null;
    let invitingAgencyId: string | null =
      callerPrimary ?? callerAgencyIds[0] ?? callerLegacyAgencyId ?? null;

    if (callerRole === "admin") {
      if (!invitingAgencyId) {
        return NextResponse.json(
          { error: "Admin must belong to an agency" },
          { status: 400 }
        );
      }
    } else {
      invitingAgencyId =
        typeof body.agencyId === "string" && body.agencyId.trim()
          ? body.agencyId.trim()
          : invitingAgencyId;
    }

    let uid: string;
    try {
      const existing = await adminAuth.getUserByEmail(email);
      uid = existing.uid;
    } catch {
      const newUser = await adminAuth.createUser({
        email,
        displayName,
        emailVerified: false,
      });
      uid = newUser.uid;
    }

    const userRef = db.doc(userDoc(uid));
    const existingSnap = await userRef.get();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const existingData = existingSnap.data();

    let agencyIds: string[] = [];
    if (existingSnap.exists && existingData) {
      agencyIds = Array.isArray(existingData.agencyIds)
        ? (existingData.agencyIds as string[]).filter((x) => typeof x === "string")
        : typeof existingData.agencyId === "string" && existingData.agencyId.trim()
          ? [existingData.agencyId.trim()]
          : [];
    }
    if (invitingAgencyId && !agencyIds.includes(invitingAgencyId)) {
      agencyIds = [...agencyIds, invitingAgencyId];
    }
    // Always set primaryAgencyId if missing (e.g. new invite or existing without primary).
    const primaryAgencyId =
      (typeof existingData?.primaryAgencyId === "string" && existingData.primaryAgencyId.trim()
        ? existingData.primaryAgencyId
        : null) ?? agencyIds[0] ?? null;

    const mergePayload: Record<string, unknown> = {
      uid,
      email,
      displayName,
      role: "landlord",
      agencyIds,
      ...(primaryAgencyId != null && { primaryAgencyId }),
      status: "pending",
      invitedAt: now,
      invitedByUid: callerUid,
      updatedAt: now,
    };
    if (!existingSnap.exists) {
      mergePayload.createdAt = now;
      mergePayload.permissions = [];
    }
    await userRef.set(mergePayload, { merge: true });

    const resetLink = await adminAuth.generatePasswordResetLink(email, {
      url: request.nextUrl.origin + "/landlord/sign-in",
    });

    if (process.env.NODE_ENV !== "production") {
      console.info("[invite-landlord] Reset link for", email, "(dev):", resetLink);
    }
    return NextResponse.json({ success: true, uid, resetLink });
  } catch (err) {
    console.error("[invite-landlord]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
