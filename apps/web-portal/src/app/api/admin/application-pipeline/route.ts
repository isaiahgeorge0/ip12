/**
 * GET /api/admin/application-pipeline?agencyId=...&stage=...&source=...&propertySearch=...&limit=...
 * List application pipeline items. Admin: own agency; superAdmin: pass agencyId.
 * Filters: stage, source, propertySearch (substring on propertyDisplayLabel or exact propertyId).
 * Order: lastActionAt desc. Includes propertyDisplayLabel; enriches applicantName from application doc.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { applicationPipelineCol, applicationsCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import {
  isPipelineSource,
  isPipelineStage,
  type PipelineSource,
  type PipelineStage,
} from "@/lib/types/applicationPipeline";

const APPLICATION_REVIEW_STAGES = new Set<PipelineStage>([
  "application_submitted",
  "application_created",
  "under_review",
  "referencing",
  "approved",
  "rejected",
  "withdrawn",
]);

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export type AdminPipelineRow = {
  id: string;
  agencyId: string;
  applicantId: string | null;
  applicantUserId: string | null;
  applicantName: string;
  applicantEmail: string | null;
  applicantPhone: string | null;
  propertyId: string;
  propertyDisplayLabel: string;
  source: PipelineSource;
  sourceEnquiryId: string | null;
  sourceViewingId: string | null;
  applicationId: string | null;
  stage: PipelineStage;
  notes: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  lastActionAt: number | null;
  /** From application doc when available */
  employmentStatus?: string | null;
  employerName?: string | null;
  jobTitle?: string | null;
  monthlyIncome?: number | null;
  annualIncome?: number | null;
};

function safeStr(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { searchParams } = new URL(request.url);
  const agencyIdParam = searchParams.get("agencyId")?.trim();
  const stageParam = searchParams.get("stage")?.trim();
  const sourceParam = searchParams.get("source")?.trim();
  const propertySearchParam = searchParams.get("propertySearch")?.trim();
  const applicantIdFilter = searchParams.get("applicantId")?.trim();
  const propertyIdFilter = searchParams.get("propertyId")?.trim();
  const applicationStagesOnly = searchParams.get("applicationStagesOnly") === "true";
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

  const stageFilter = stageParam && isPipelineStage(stageParam) ? (stageParam as PipelineStage) : null;
  const sourceFilter = sourceParam && isPipelineSource(sourceParam) ? (sourceParam as PipelineSource) : null;

  const db = getAdminFirestore();
  const col = db.collection(applicationPipelineCol(agencyId));
  const snap = await col.orderBy("lastActionAt", "desc").limit(limit * 3).get();
  const raw: AdminPipelineRow[] = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const stage = (isPipelineStage(d.stage) ? d.stage : "prompt_sent") as PipelineStage;
    const source = (isPipelineSource(d.source) ? d.source : "proceed_prompt") as PipelineSource;
    if (stageFilter != null && stage !== stageFilter) continue;
    if (sourceFilter != null && source !== sourceFilter) continue;
    if (applicationStagesOnly && !APPLICATION_REVIEW_STAGES.has(stage)) continue;
    if (applicantIdFilter && d.applicantId !== applicantIdFilter) continue;
    if (propertyIdFilter && d.propertyId !== propertyIdFilter) continue;
    if (propertySearchParam) {
      const label = (typeof d.propertyDisplayLabel === "string" ? d.propertyDisplayLabel : "").toLowerCase();
      const id = (typeof d.propertyId === "string" ? d.propertyId : "").toLowerCase();
      const search = propertySearchParam.toLowerCase();
      if (!label.includes(search) && !id.includes(search)) continue;
    }
    raw.push({
      id: doc.id,
      agencyId: typeof d.agencyId === "string" ? d.agencyId : agencyId,
      applicantId: typeof d.applicantId === "string" ? d.applicantId : null,
      applicantUserId: typeof d.applicantUserId === "string" ? d.applicantUserId : null,
      applicantName: "",
      applicantEmail: null,
      applicantPhone: null,
      propertyId: typeof d.propertyId === "string" ? d.propertyId : "",
      propertyDisplayLabel: typeof d.propertyDisplayLabel === "string" ? d.propertyDisplayLabel : `Property ${d.propertyId ?? ""}`,
      source,
      sourceEnquiryId: typeof d.sourceEnquiryId === "string" ? d.sourceEnquiryId : null,
      sourceViewingId: typeof d.sourceViewingId === "string" ? d.sourceViewingId : null,
      applicationId: typeof d.applicationId === "string" ? d.applicationId : null,
      stage,
      notes: typeof d.notes === "string" ? d.notes : null,
      createdAt: serializeTimestamp(d.createdAt) ?? null,
      updatedAt: serializeTimestamp(d.updatedAt) ?? null,
      lastActionAt: serializeTimestamp(d.lastActionAt) ?? null,
    });
    if (raw.length >= limit) break;
  }

  const applicantIds = [...new Set(raw.map((r) => r.applicantId).filter(Boolean))] as string[];
  const appDataByApplicantId = new Map<
    string,
    {
      fullName: string;
      email: string | null;
      phone: string | null;
      employmentStatus: string | null;
      employerName: string | null;
      jobTitle: string | null;
      monthlyIncome: number | null;
      annualIncome: number | null;
    }
  >();
  if (applicantIds.length > 0) {
    const appCol = db.collection(applicationsCol(agencyId));
    const refs = applicantIds.slice(0, 30).map((id) => appCol.doc(id));
    const appSnaps = await db.getAll(...refs);
    appSnaps.forEach((s, idx) => {
      const id = applicantIds[idx];
      if (id && s.exists) {
        const data = s.data() ?? {};
        appDataByApplicantId.set(id, {
          fullName: typeof data.fullName === "string" ? data.fullName : "",
          email: typeof data.email === "string" ? data.email : null,
          phone: typeof data.phone === "string" ? data.phone : null,
          employmentStatus: typeof data.employmentStatus === "string" ? data.employmentStatus : null,
          employerName: typeof data.employerName === "string" ? data.employerName : null,
          jobTitle: typeof data.jobTitle === "string" ? data.jobTitle : null,
          monthlyIncome: typeof data.monthlyIncome === "number" ? data.monthlyIncome : null,
          annualIncome: typeof data.annualIncome === "number" ? data.annualIncome : null,
        });
      }
    });
  }

  const rows: AdminPipelineRow[] = raw.map((r) => {
    const app = r.applicantId ? appDataByApplicantId.get(r.applicantId) : undefined;
    return {
      ...r,
      applicantName: app?.fullName ?? "",
      applicantEmail: app?.email ?? null,
      applicantPhone: app?.phone ?? null,
      employmentStatus: app?.employmentStatus ?? null,
      employerName: app?.employerName ?? null,
      jobTitle: app?.jobTitle ?? null,
      monthlyIncome: app?.monthlyIncome ?? null,
      annualIncome: app?.annualIncome ?? null,
    };
  });

  return NextResponse.json(rows);
}
