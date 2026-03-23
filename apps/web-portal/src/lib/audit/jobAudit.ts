/**
 * Server-only: audit log entries for maintenance job create/update/status.
 * Uses unified writeAuditLog.
 */

import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import type { JobStatus, JobPriority } from "@/lib/types/job";

export type JobAuditAction = "JOB_CREATED" | "JOB_UPDATED" | "JOB_STATUS_UPDATED";

export type JobAuditPayload = {
  action: JobAuditAction;
  actorUid: string;
  actorAgencyId: string | null;
  role: string;
  jobId: string;
  agencyId: string;
  ticketId?: string;
  propertyId?: string | null;
  propertyDisplayLabel?: string | null;
  contractorId?: string;
  contractorName?: string;
  previousStatus?: JobStatus;
  nextStatus?: JobStatus;
  previousPriority?: JobPriority;
  nextPriority?: JobPriority;
};

function toAuditRole(role: string): "admin" | "superAdmin" {
  if (role === "superAdmin") return "superAdmin";
  return "admin";
}

export function writeJobAudit(payload: JobAuditPayload): void {
  const bypass = payload.role === "superAdmin";
  const meta: Record<string, unknown> = {};
  if (payload.ticketId != null) meta.ticketId = payload.ticketId;
  if (payload.propertyId != null) meta.propertyId = payload.propertyId;
  if (payload.propertyDisplayLabel != null) meta.propertyDisplayLabel = payload.propertyDisplayLabel;
  if (payload.contractorId != null) meta.contractorId = payload.contractorId;
  if (payload.contractorName != null) meta.contractorName = payload.contractorName;
  if (payload.action === "JOB_STATUS_UPDATED") {
    meta.before = payload.previousStatus;
    meta.after = payload.nextStatus;
  }
  if (payload.previousPriority != null || payload.nextPriority != null) {
    meta.priorityBefore = payload.previousPriority;
    meta.priorityAfter = payload.nextPriority;
  }

  writeAuditLog({
    action: payload.action,
    actorUid: payload.actorUid,
    actorRole: toAuditRole(payload.role),
    actorAgencyId: payload.actorAgencyId,
    targetType: "job",
    targetId: payload.jobId,
    agencyId: payload.agencyId,
    meta: Object.keys(meta).length ? meta : undefined,
    bypass,
  });
}
