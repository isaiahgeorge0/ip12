import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  jobsCol,
  ticketsCol,
  propertiesCol,
  contractorDoc,
} from "@/lib/firestore/paths";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";
import { serializeTimestamp } from "@/lib/serialization";
import type { JobListItem, JobStatus, JobPriority } from "@/lib/types/job";
import { isJobStatus, isJobPriority } from "@/lib/types/job";

function resolveAgencyId(
  session: { role: string; agencyId: string | null },
  request: NextRequest,
  body?: { agencyId?: string }
): string | null {
  let agencyId = session.agencyId ?? "";
  if (!agencyId && session.role === "superAdmin") {
    const fromQuery = request.nextUrl.searchParams.get("agencyId")?.trim();
    const fromBody = typeof body?.agencyId === "string" ? body.agencyId.trim() : "";
    agencyId = fromQuery || fromBody || "";
  }
  return agencyId || null;
}

function toListItem(doc: FirebaseFirestore.QueryDocumentSnapshot): JobListItem {
  const d = doc.data();
  return {
    id: doc.id,
    title: typeof d.title === "string" ? d.title : "",
    contractorName: typeof d.contractorName === "string" ? d.contractorName : "",
    contractorId: typeof d.contractorId === "string" ? d.contractorId : "",
    propertyDisplayLabel: typeof d.propertyDisplayLabel === "string" ? d.propertyDisplayLabel : null,
    propertyId: typeof d.propertyId === "string" ? d.propertyId : null,
    ticketId: typeof d.ticketId === "string" ? d.ticketId : "",
    status: (isJobStatus(d.status) ? d.status : "assigned") as JobStatus,
    priority: (isJobPriority(d.priority) ? d.priority : "normal") as JobPriority,
    scheduledFor: typeof d.scheduledFor === "string" ? d.scheduledFor : null,
    updatedAt: serializeTimestamp(d.updatedAt) ?? null,
    createdAt: serializeTimestamp(d.createdAt) ?? null,
  };
}

/**
 * GET /api/admin/jobs
 * List jobs for the agency. Filters: status, contractorId, ticketId, q, priority, limit.
 */
export async function GET(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const agencyId = resolveAgencyId(session, request);
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status")?.trim() ?? "";
  const contractorIdParam = searchParams.get("contractorId")?.trim() ?? "";
  const ticketIdParam = searchParams.get("ticketId")?.trim() ?? "";
  const q = searchParams.get("q")?.trim() ?? "";
  const priorityParam = searchParams.get("priority")?.trim() ?? "";
  const limitParam = searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam ?? "200", 10), 1), 500);

  const db = getAdminFirestore();
  let query: FirebaseFirestore.Query = db
    .collection(jobsCol(agencyId))
    .orderBy("updatedAt", "desc")
    .limit(limit * 2);

  if (contractorIdParam) {
    query = query.where("contractorId", "==", contractorIdParam);
  }
  if (ticketIdParam) {
    query = query.where("ticketId", "==", ticketIdParam);
  }

  const snap = await query.get();
  let list: JobListItem[] = snap.docs.map((doc) => toListItem(doc));

  if (statusParam && isJobStatus(statusParam)) {
    list = list.filter((j) => j.status === statusParam);
  }
  if (priorityParam && isJobPriority(priorityParam)) {
    list = list.filter((j) => j.priority === priorityParam);
  }
  if (q) {
    const qLower = q.toLowerCase();
    list = list.filter(
      (j) =>
        j.title.toLowerCase().includes(qLower) ||
        j.contractorName.toLowerCase().includes(qLower) ||
        (j.propertyDisplayLabel?.toLowerCase().includes(qLower))
    );
  }

  list = list.slice(0, limit);
  return NextResponse.json(list);
}

/**
 * POST /api/admin/jobs
 * Create a job from a ticket. Loads ticket and contractor, validates same agency, resolves property label.
 */
export async function POST(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  let body: {
    agencyId?: string;
    ticketId?: string;
    contractorId?: string;
    title?: string;
    description?: string;
    priority?: string;
    scheduledFor?: string | null;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const agencyId = resolveAgencyId(session, request, body);
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const ticketId = typeof body.ticketId === "string" ? body.ticketId.trim() : "";
  const contractorId = typeof body.contractorId === "string" ? body.contractorId.trim() : "";
  if (!ticketId || !contractorId) {
    return NextResponse.json(
      { error: "ticketId and contractorId required" },
      { status: 400 }
    );
  }

  const db = getAdminFirestore();
  const [ticketSnap, contractorSnap] = await Promise.all([
    db.collection(ticketsCol(agencyId)).doc(ticketId).get(),
    db.doc(contractorDoc(agencyId, contractorId)).get(),
  ]);

  if (!ticketSnap.exists) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (!contractorSnap.exists) {
    return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
  }

  const ticketData = ticketSnap.data()!;
  const contractorData = contractorSnap.data()!;
  const ticketAgencyId = ticketData.agencyId ?? agencyId;
  const contractorAgencyId = contractorData.agencyId ?? agencyId;
  if (ticketAgencyId !== agencyId || contractorAgencyId !== agencyId) {
    return NextResponse.json(
      { error: "Ticket and contractor must belong to the same agency" },
      { status: 400 }
    );
  }

  const propertyId = typeof ticketData.propertyId === "string" ? ticketData.propertyId : null;
  let propertyDisplayLabelResolved: string | null = null;
  if (propertyId) {
    const propSnap = await db.doc(`${propertiesCol(agencyId)}/${propertyId}`).get();
    if (propSnap.exists && propSnap.data()) {
      propertyDisplayLabelResolved = propertyDisplayLabel(
        propSnap.data() as Record<string, unknown>,
        propertyId
      );
    } else {
      propertyDisplayLabelResolved = `Property ${propertyId}`;
    }
  }

  const ticketTitle = typeof ticketData.title === "string" ? ticketData.title : "";
  const ticketCategory = typeof ticketData.category === "string" ? ticketData.category : "General";
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : ticketTitle || `${ticketCategory} – maintenance`;
  const description =
    typeof body.description === "string" ? body.description.trim() || null : null;
  const priority = isJobPriority(body.priority) ? body.priority : "normal";
  const scheduledFor =
    typeof body.scheduledFor === "string" && body.scheduledFor.trim()
      ? body.scheduledFor.trim()
      : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  const contractorName =
    typeof contractorData.displayName === "string"
      ? contractorData.displayName
      : contractorSnap.id;

  const { writeJobAudit } = await import("@/lib/audit/jobAudit");
  const ref = await db.collection(jobsCol(agencyId)).add({
    agencyId,
    ticketId,
    propertyId,
    propertyDisplayLabel: propertyDisplayLabelResolved,
    contractorId,
    contractorName,
    title,
    description,
    status: "assigned",
    priority,
    scheduledFor,
    completedAt: null,
    notes,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: session.uid,
    updatedBy: session.uid,
  });

  writeJobAudit({
    action: "JOB_CREATED",
    actorUid: session.uid,
    actorAgencyId: session.agencyId,
    role: session.role,
    jobId: ref.id,
    agencyId,
    ticketId,
    propertyId,
    propertyDisplayLabel: propertyDisplayLabelResolved,
    contractorId,
    contractorName,
  });

  return NextResponse.json({
    id: ref.id,
    agencyId,
    ticketId,
    propertyId,
    propertyDisplayLabel: propertyDisplayLabelResolved,
    contractorId,
    contractorName,
    title,
    description,
    status: "assigned",
    priority,
    scheduledFor,
    notes,
  });
}
