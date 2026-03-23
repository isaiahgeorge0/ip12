/**
 * POST /api/enquiries
 * Submit an enquiry from a signed-in user (e.g. public listing detail).
 * Creates/updates applicant profile (stable fields) then writes enquiry with full snapshot.
 * Body: agencyId, propertyId, message; optional applicantName, applicantPhone, moveInDate,
 * hasPets, petDetails, hasChildren, employmentStatus, smoker, intendedOccupants, incomeNotes.
 * Writes to agencies/{agencyId}/enquiries and applicants/{userId}. Server-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  applicantDoc,
  enquiriesCol,
  propertiesCol,
  PROPERTY_INDEX_COLLECTION,
  propertyIndexDocId,
  userDoc,
} from "@/lib/firestore/paths";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { EMPLOYMENT_STATUSES } from "@/lib/types/applicantProfile";
import { DEFAULT_ENQUIRY_STATUS } from "@/lib/types/enquiry";

const MESSAGE_MIN = 10;
const MESSAGE_MAX = 2000;
const DUPLICATE_WINDOW_SEC = 60;

function safeStr(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v.trim() : "";
}

function safeNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function safeBool(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  return null;
}

const VALID_EMPLOYMENT = new Set<string>(EMPLOYMENT_STATUSES);

/** Build applicant profile doc for Firestore (no undefined). */
function buildApplicantDoc(p: {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  hasPets: boolean | null;
  petDetails: string | null;
  hasChildren: boolean | null;
  employmentStatus: string | null;
  incomeNotes: string | null;
  smoker: boolean | null;
  intendedOccupants: number | null;
}): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    userId: p.userId,
    fullName: p.fullName || "Applicant",
    email: p.email || "",
    phone: p.phone ?? null,
    hasPets: p.hasPets,
    petDetails: p.petDetails ?? null,
    hasChildren: p.hasChildren,
    employmentStatus: p.employmentStatus ?? null,
    incomeNotes: p.incomeNotes ?? null,
    smoker: p.smoker,
    intendedOccupants: p.intendedOccupants,
    updatedAt: FieldValue.serverTimestamp(),
  };
  return doc;
}

/** Build Firestore enquiry doc with no undefined values. */
function buildEnquiryDoc(p: {
  propertyId: string;
  agencyId: string;
  applicantUserId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  message: string;
  moveInDate: string | null;
  hasPets: boolean | null;
  petDetails: string | null;
  hasChildren: boolean | null;
  employmentStatus: string | null;
  smoker: boolean | null;
  intendedOccupants: number | null;
  incomeNotes: string | null;
}): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    propertyId: p.propertyId,
    agencyId: p.agencyId,
    applicantUserId: p.applicantUserId,
    applicantName: p.applicantName || "Applicant",
    applicantEmail: p.applicantEmail || "",
    message: p.message,
    source: "public_listing",
    status: DEFAULT_ENQUIRY_STATUS,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (p.applicantPhone != null && p.applicantPhone !== "") doc.applicantPhone = p.applicantPhone;
  if (p.moveInDate != null && p.moveInDate !== "") doc.moveInDate = p.moveInDate;
  if (p.hasPets !== null) doc.hasPets = p.hasPets;
  if (p.petDetails != null && p.petDetails !== "") doc.petDetails = p.petDetails;
  if (p.hasChildren !== null) doc.hasChildren = p.hasChildren;
  if (p.employmentStatus != null && p.employmentStatus !== "") doc.employmentStatus = p.employmentStatus;
  if (p.smoker !== null) doc.smoker = p.smoker;
  if (p.intendedOccupants !== null) doc.intendedOccupants = p.intendedOccupants;
  if (p.incomeNotes != null && p.incomeNotes !== "") doc.incomeNotes = p.incomeNotes;
  return doc;
}

export async function POST(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;

  let body: {
    agencyId?: unknown;
    propertyId?: unknown;
    message?: unknown;
    applicantName?: unknown;
    applicantPhone?: unknown;
    moveInDate?: unknown;
    hasPets?: unknown;
    petDetails?: unknown;
    hasChildren?: unknown;
    employmentStatus?: unknown;
    smoker?: unknown;
    intendedOccupants?: unknown;
    incomeNotes?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const agencyId = safeStr(body.agencyId);
  const propertyId = safeStr(body.propertyId);
  const message = safeStr(body.message);
  const moveInDateRaw = safeStr(body.moveInDate);
  const moveInDate = moveInDateRaw || null;
  const hasPets = safeBool(body.hasPets);
  const petDetails = safeStr(body.petDetails) || null;
  const hasChildren = safeBool(body.hasChildren);
  const employmentStatusRaw = safeStr(body.employmentStatus);
  const employmentStatus = employmentStatusRaw && VALID_EMPLOYMENT.has(employmentStatusRaw) ? employmentStatusRaw : null;
  const smoker = safeBool(body.smoker);
  const intendedOccupantsRaw = safeNum(body.intendedOccupants);
  const intendedOccupants = intendedOccupantsRaw != null && intendedOccupantsRaw >= 1 ? intendedOccupantsRaw : null;
  const incomeNotes = safeStr(body.incomeNotes) || null;

  if (moveInDate) {
    const d = new Date(moveInDate);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid move-in date" }, { status: 400 });
    }
  }

  if (!agencyId || !propertyId) {
    return NextResponse.json(
      { error: "agencyId and propertyId are required" },
      { status: 400 }
    );
  }
  if (message.length < MESSAGE_MIN) {
    return NextResponse.json(
      { error: `Message must be at least ${MESSAGE_MIN} characters` },
      { status: 400 }
    );
  }
  if (message.length > MESSAGE_MAX) {
    return NextResponse.json(
      { error: `Message must be at most ${MESSAGE_MAX} characters` },
      { status: 400 }
    );
  }

  try {
    const db = getAdminFirestore();

    // Validate property: must exist in propertyIndex (public listing source) or canonical
    const indexDocId = propertyIndexDocId(agencyId, propertyId);
    const indexSnap = await db.collection(PROPERTY_INDEX_COLLECTION).doc(indexDocId).get();
    if (!indexSnap.exists) {
      const canonSnap = await db.doc(`${propertiesCol(agencyId)}/${propertyId}`).get();
      if (!canonSnap.exists) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[enquiries] property not found:", { agencyId, propertyId });
        }
        return NextResponse.json(
          { error: "Property not found or not available for enquiries" },
          { status: 404 }
        );
      }
    }

    // Duplicate check: same applicantUserId + same propertyId + same agencyId, within last DUPLICATE_WINDOW_SEC.
    // Enforced strictly: on query error we do not create an enquiry (fail closed).
    const enquiriesRef = db.collection(enquiriesCol(agencyId));
    let hasRecent: boolean;
    try {
      const recentSnap = await enquiriesRef
        .where("applicantUserId", "==", session.uid)
        .where("propertyId", "==", propertyId)
        .orderBy("createdAt", "desc")
        .limit(5)
        .get();
      const windowMs = Date.now() - DUPLICATE_WINDOW_SEC * 1000;
      hasRecent = recentSnap.docs.some((d) => {
        const data = d.data();
        const t = data.createdAt;
        if (!t || typeof (t as { toMillis?: () => number }).toMillis !== "function") return true;
        return (t as { toMillis: () => number }).toMillis() >= windowMs;
      });
    } catch (dupErr) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[enquiries] duplicate check failed; refusing to create enquiry (fail closed):", dupErr);
      }
      return NextResponse.json(
        { error: "Unable to verify duplicate. Please try again in a moment." },
        { status: 503 }
      );
    }
    if (hasRecent) {
      return NextResponse.json(
        { error: "You already submitted an enquiry for this property recently. Please wait before sending another." },
        { status: 429 }
      );
    }

    // Applicant details from profile (allow optional overrides from body)
    const userSnap = await db.doc(userDoc(session.uid)).get();
    const userData = userSnap.data();
    const applicantName =
      safeStr(body.applicantName) ||
      (typeof userData?.displayName === "string" ? userData.displayName.trim() : "") ||
      (session.email ?? "").split("@")[0] ||
      "Applicant";
    const applicantEmail = session.email ?? "";
    const applicantPhoneRaw = safeStr(body.applicantPhone) || (typeof userData?.phone === "string" ? userData.phone.trim() : "");
    const applicantPhone = applicantPhoneRaw !== "" ? applicantPhoneRaw : null;

    // Upsert applicant profile (stable fields only)
    const applicantRef = db.doc(applicantDoc(session.uid));
    const applicantSnap = await applicantRef.get();
    const applicantPayload = buildApplicantDoc({
      userId: session.uid,
      fullName: applicantName || "Applicant",
      email: applicantEmail,
      phone: applicantPhone,
      hasPets,
      petDetails,
      hasChildren,
      employmentStatus,
      incomeNotes,
      smoker,
      intendedOccupants,
    });
    if (applicantSnap.exists) {
      await applicantRef.update(applicantPayload);
    } else {
      await applicantRef.set({
        ...applicantPayload,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    const docData = buildEnquiryDoc({
      propertyId,
      agencyId,
      applicantUserId: session.uid,
      applicantName: applicantName || "Applicant",
      applicantEmail,
      applicantPhone,
      message,
      moveInDate,
      hasPets,
      petDetails,
      hasChildren,
      employmentStatus,
      smoker,
      intendedOccupants,
      incomeNotes,
    });

    const ref = await enquiriesRef.add(docData);

    try {
      writeAuditLog({
        action: "ENQUIRY_SUBMITTED",
        actorUid: session.uid,
        actorRole:
          session.role === "superAdmin" || session.role === "landlord" || session.role === "public"
            ? session.role
            : "admin",
        actorAgencyId: session.agencyId,
        targetType: "enquiry",
        targetId: ref.id,
        agencyId,
        meta: {
          propertyId,
          applicantUserId: session.uid,
          source: "public_listing",
        },
      });
    } catch {
      // Fire-and-forget; do not fail the request
    }

    return NextResponse.json({ ok: true, enquiryId: ref.id });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[enquiries] POST unexpected error:", err);
    }
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
