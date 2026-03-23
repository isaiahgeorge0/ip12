import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { jobDoc, jobsCol } from "@/lib/firestore/paths";
import { writeJobAudit } from "@/lib/audit/jobAudit";
import { serializeTimestamp } from "@/lib/serialization";
import type { JobStatus, JobPriority } from "@/lib/types/job";
import { isJobStatus, isJobPriority } from "@/lib/types/job";

function resolveAgencyId(
  session: { role: string; agencyId: string | null },
  request: NextRequest
): string | null {
  let agencyId = session.agencyId ?? "";
  if (!agencyId && session.role === "superAdmin") {
    agencyId = request.nextUrl.searchParams.get("agencyId")?.trim() ?? "";
  }
  return agencyId || null;
}

/**
 * GET /api/admin/jobs/[jobId]
 * Returns full job detail.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const agencyId = resolveAgencyId(session, request);
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const { jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.doc(jobDoc(agencyId, jobId));
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const d = snap.data()!;
  return NextResponse.json({
    id: snap.id,
    agencyId: d.agencyId ?? agencyId,
    ticketId: d.ticketId ?? "",
    propertyId: typeof d.propertyId === "string" ? d.propertyId : null,
    propertyDisplayLabel: typeof d.propertyDisplayLabel === "string" ? d.propertyDisplayLabel : null,
    contractorId: d.contractorId ?? "",
    contractorName: d.contractorName ?? "",
    title: d.title ?? "",
    description: typeof d.description === "string" ? d.description : null,
    status: isJobStatus(d.status) ? d.status : "assigned",
    priority: isJobPriority(d.priority) ? d.priority : "normal",
    scheduledFor: typeof d.scheduledFor === "string" ? d.scheduledFor : null,
    completedAt: serializeTimestamp(d.completedAt) ?? null,
    notes: typeof d.notes === "string" ? d.notes : null,
    createdAt: serializeTimestamp(d.createdAt) ?? null,
    updatedAt: serializeTimestamp(d.updatedAt) ?? null,
    createdBy: d.createdBy ?? "",
    updatedBy: d.updatedBy ?? "",
  });
}

/**
 * PATCH /api/admin/jobs/[jobId]
 * Editable: status, priority, scheduledFor, notes, title, description.
 * If status -> completed, set completedAt = now. If status changes away from completed, clear completedAt.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const agencyId = resolveAgencyId(session, request);
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const { jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  let body: {
    status?: string;
    priority?: string;
    scheduledFor?: string | null;
    notes?: string;
    title?: string;
    description?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.doc(jobDoc(agencyId, jobId));
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const data = snap.data()!;
  const previousStatus = (isJobStatus(data.status) ? data.status : "assigned") as JobStatus;
  const previousPriority = (isJobPriority(data.priority) ? data.priority : "normal") as JobPriority;

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: session.uid,
  };

  if (typeof body.status === "string" && isJobStatus(body.status)) {
    updates.status = body.status;
    if (body.status === "completed") {
      updates.completedAt = FieldValue.serverTimestamp();
    } else if (previousStatus === "completed") {
      updates.completedAt = null;
    }
  }
  if (typeof body.priority === "string" && isJobPriority(body.priority)) {
    updates.priority = body.priority;
  }
  if (body.scheduledFor !== undefined) {
    updates.scheduledFor =
      typeof body.scheduledFor === "string" && body.scheduledFor.trim()
        ? body.scheduledFor.trim()
        : null;
  }
  if (body.notes !== undefined) {
    updates.notes =
      typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  }
  if (typeof body.title === "string" && body.title.trim()) {
    updates.title = body.title.trim();
  }
  if (body.description !== undefined) {
    updates.description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
  }

  await ref.update(updates);

  const nextStatus = (updates.status as JobStatus) ?? previousStatus;
  const nextPriority = (updates.priority as JobPriority) ?? previousPriority;
  const statusChanged = previousStatus !== nextStatus;

  writeJobAudit({
    action: statusChanged ? "JOB_STATUS_UPDATED" : "JOB_UPDATED",
    actorUid: session.uid,
    actorAgencyId: session.agencyId,
    role: session.role,
    jobId,
    agencyId,
    ticketId: data.ticketId,
    propertyId: data.propertyId,
    propertyDisplayLabel: data.propertyDisplayLabel,
    contractorId: data.contractorId,
    contractorName: data.contractorName,
    ...(statusChanged && {
      previousStatus,
      nextStatus,
    }),
    ...(previousPriority !== nextPriority && {
      previousPriority,
      nextPriority,
    }),
  });

  const updated = { ...data, ...updates };
  return NextResponse.json({
    id: jobId,
    agencyId,
    ticketId: updated.ticketId,
    propertyId: updated.propertyId ?? null,
    propertyDisplayLabel: updated.propertyDisplayLabel ?? null,
    contractorId: updated.contractorId,
    contractorName: updated.contractorName,
    title: updated.title ?? "",
    description: updated.description ?? null,
    status: updated.status ?? previousStatus,
    priority: updated.priority ?? previousPriority,
    scheduledFor: updated.scheduledFor ?? null,
    completedAt: serializeTimestamp(updated.completedAt) ?? null,
    notes: updated.notes ?? null,
    createdAt: serializeTimestamp(updated.createdAt) ?? null,
    updatedAt: serializeTimestamp(updated.updatedAt) ?? null,
    createdBy: updated.createdBy ?? "",
    updatedBy: updated.updatedBy ?? "",
  });
}
