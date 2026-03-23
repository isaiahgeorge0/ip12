/**
 * GET /api/admin/applicants-list?agencyId=...&limit=...
 * Returns applicant profiles (from applicants/ collection) who have at least one enquiry in this agency.
 * Each row includes lastEnquiryAt, enquiryCount, and recent property/enquiry context for CRM.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { applicantDoc, applicationsCol, enquiriesCol, propertiesCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import { normaliseEnquiryStatus, type EnquiryStatus } from "@/lib/types/enquiry";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 300;

export type AdminApplicantListItem = {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  hasPets: boolean | null;
  petDetails: string | null;
  hasChildren: boolean | null;
  employmentStatus: string | null;
  smoker: boolean | null;
  intendedOccupants: number | null;
  lastEnquiryAt: number | null;
  enquiryCount: number;
  latestEnquiryStatus: EnquiryStatus;
  latestEnquiryId: string | null;
  /** If set, this enquiry-user already has a CRM applicant; link instead of convert. */
  existingApplicantId: string | null;
  recentEnquiries: { enquiryId: string; propertyId: string; propertyDisplayLabel: string; createdAt: number | null; status: EnquiryStatus }[];
};

export async function GET(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { searchParams } = new URL(request.url);
  const agencyIdParam = searchParams.get("agencyId")?.trim();
  const limitParam = searchParams.get("limit");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT)
  );
  if (!Number.isFinite(limit)) {
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
  }

  let agencyId: string;
  if (session.role === "superAdmin" && agencyIdParam) {
    agencyId = agencyIdParam;
  } else {
    agencyId = session.agencyId ?? "";
  }
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const [enquiriesSnap, applicationsSnap] = await Promise.all([
    db.collection(enquiriesCol(agencyId)).orderBy("createdAt", "desc").limit(500).get(),
    db.collection(applicationsCol(agencyId)).get(),
  ]);

  const applicantIdByUserId = new Map<string, string>();
  const applicantIdByEmail = new Map<string, string>();
  for (const appDoc of applicationsSnap.docs) {
    const d = appDoc.data();
    const id = appDoc.id;
    if (typeof d.applicantUserId === "string" && d.applicantUserId) {
      applicantIdByUserId.set(d.applicantUserId, id);
    }
    const email = (typeof d.email === "string" && d.email ? d.email : "").trim().toLowerCase();
    if (email && !applicantIdByEmail.has(email)) {
      applicantIdByEmail.set(email, id);
    }
  }

  const byUserId = new Map<
    string,
    { createdAtMs: number; enquiryId: string; propertyId: string; status: EnquiryStatus }[]
  >();
  for (const doc of enquiriesSnap.docs) {
    const d = doc.data();
    const uid = typeof d.applicantUserId === "string" ? d.applicantUserId : "";
    if (!uid) continue;
    const createdAtMs = serializeTimestamp(d.createdAt) ?? 0;
    const propertyId = typeof d.propertyId === "string" ? d.propertyId : "";
    const status = normaliseEnquiryStatus(d.status);
    if (!byUserId.has(uid)) {
      byUserId.set(uid, []);
    }
    byUserId.get(uid)!.push({
      createdAtMs,
      enquiryId: doc.id,
      propertyId,
      status,
    });
  }

  const list: AdminApplicantListItem[] = [];
  for (const [userId, enquiries] of byUserId.entries()) {
    const applicantSnap = await db.doc(applicantDoc(userId)).get();
    const data = applicantSnap.exists ? applicantSnap.data() : {};
    const d = (data ?? {}) as Record<string, unknown>;
    const sorted = [...enquiries].sort((a, b) => b.createdAtMs - a.createdAtMs);
    const latest = sorted[0];
    const recentEnquiries = sorted.slice(0, 5).map((e) => ({
      enquiryId: e.enquiryId,
      propertyId: e.propertyId,
      propertyDisplayLabel: "", // filled after batch fetch
      createdAt: e.createdAtMs || null,
      status: e.status,
    }));
    const firstEnquiryDoc = sorted[0]
      ? enquiriesSnap.docs.find((doc) => doc.id === sorted[0].enquiryId)
      : undefined;
    const enquiryData = (firstEnquiryDoc?.data() ?? {}) as Record<string, unknown>;
    list.push({
      userId,
      fullName:
        (typeof d.fullName === "string" && d.fullName) ||
        (typeof enquiryData.applicantName === "string" ? enquiryData.applicantName : "") ||
        "",
      email:
        (typeof d.email === "string" && d.email) ||
        (typeof enquiryData.applicantEmail === "string" ? enquiryData.applicantEmail : "") ||
        "",
      phone:
        typeof d.phone === "string"
          ? d.phone
          : typeof enquiryData.applicantPhone === "string"
            ? enquiryData.applicantPhone
            : null,
      hasPets: typeof d.hasPets === "boolean" ? d.hasPets : null,
      petDetails: typeof d.petDetails === "string" ? d.petDetails : null,
      hasChildren: typeof d.hasChildren === "boolean" ? d.hasChildren : null,
      employmentStatus: typeof d.employmentStatus === "string" ? d.employmentStatus : null,
      smoker: typeof d.smoker === "boolean" ? d.smoker : null,
      intendedOccupants:
        typeof d.intendedOccupants === "number" && Number.isFinite(d.intendedOccupants)
          ? d.intendedOccupants
          : null,
      lastEnquiryAt: sorted[0]?.createdAtMs ?? null,
      enquiryCount: enquiries.length,
      latestEnquiryStatus: latest?.status ?? "new",
      latestEnquiryId: latest?.enquiryId ?? null,
      existingApplicantId:
        applicantIdByUserId.get(userId) ??
        applicantIdByEmail.get(
          ((typeof d.email === "string" && d.email) ||
            (typeof enquiryData.applicantEmail === "string" ? enquiryData.applicantEmail : ""))
            .trim()
            .toLowerCase()
        ) ??
        null,
      recentEnquiries,
    });
  }
  list.sort((a, b) => (b.lastEnquiryAt ?? 0) - (a.lastEnquiryAt ?? 0));
  const trimmed = list.slice(0, limit);

  const propertyIds = [...new Set(trimmed.flatMap((a) => a.recentEnquiries.map((e) => e.propertyId).filter(Boolean)))] as string[];
  const propertyLabelById = new Map<string, string>();
  if (propertyIds.length > 0) {
    const BATCH = 30;
    for (let i = 0; i < propertyIds.length; i += BATCH) {
      const batch = propertyIds.slice(i, i + BATCH);
      const refs = batch.map((id) => db.collection(propertiesCol(agencyId)).doc(id));
      const snaps = await db.getAll(...refs);
      snaps.forEach((s, idx) => {
        const id = batch[idx];
        if (id) propertyLabelById.set(id, propertyDisplayLabel(s.exists ? s.data() ?? null : null, id));
      });
    }
  }

  const enriched = trimmed.map((item) => ({
    ...item,
    recentEnquiries: item.recentEnquiries.map((e) => ({
      ...e,
      propertyDisplayLabel: propertyLabelById.get(e.propertyId) ?? propertyDisplayLabel(null, e.propertyId),
    })),
  }));

  return NextResponse.json(enriched);
}
