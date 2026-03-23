/**
 * GET /api/applicant/me
 * Returns the current user's applicant profile for enquiry form prefill.
 * Returns 200 with profile object or { profile: null } if none exists.
 */

import { NextResponse } from "next/server";
import { requireServerSessionApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { applicantDoc } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import type { ApplicantProfile } from "@/lib/types/applicantProfile";

function toProfile(userId: string, d: Record<string, unknown>): ApplicantProfile | null {
  const createdAt = serializeTimestamp(d.createdAt) ?? d.createdAt;
  const updatedAt = serializeTimestamp(d.updatedAt) ?? d.updatedAt;
  return {
    userId,
    fullName: typeof d.fullName === "string" ? d.fullName : "",
    email: typeof d.email === "string" ? d.email : "",
    phone: typeof d.phone === "string" ? d.phone : null,
    hasPets: typeof d.hasPets === "boolean" ? d.hasPets : null,
    petDetails: typeof d.petDetails === "string" ? d.petDetails : null,
    hasChildren: typeof d.hasChildren === "boolean" ? d.hasChildren : null,
    employmentStatus:
      typeof d.employmentStatus === "string" && d.employmentStatus
        ? (d.employmentStatus as ApplicantProfile["employmentStatus"])
        : null,
    incomeNotes: typeof d.incomeNotes === "string" ? d.incomeNotes : null,
    smoker: typeof d.smoker === "boolean" ? d.smoker : null,
    intendedOccupants:
      typeof d.intendedOccupants === "number" && Number.isFinite(d.intendedOccupants)
        ? d.intendedOccupants
        : null,
    createdAt,
    updatedAt,
  };
}

export async function GET() {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;

  try {
    const db = getAdminFirestore();
    const snap = await db.doc(applicantDoc(session.uid)).get();
    if (!snap.exists) {
      return NextResponse.json({ profile: null });
    }
    const data = snap.data() as Record<string, unknown>;
    const profile = toProfile(session.uid, data ?? {});
    return NextResponse.json({ profile });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[applicant/me]", err);
    }
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}
