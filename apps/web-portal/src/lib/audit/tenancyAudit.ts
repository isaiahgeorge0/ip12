/**
 * Server-only: audit log entries for tenancy create/update/status change.
 * Uses unified writeAuditLog. Actions: TENANCY_CREATED (from queue), TENANCY_UPDATED, TENANCY_STATUS_UPDATED.
 */

import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import type { TenancyStatus } from "@/lib/types/tenancy";

export type TenancyAuditAction = "TENANCY_CREATED" | "TENANCY_UPDATED" | "TENANCY_STATUS_UPDATED";

export type TenancyAuditPayload = {
  action: TenancyAuditAction;
  actorUid: string;
  actorAgencyId: string | null;
  role: string;
  tenancyId: string;
  agencyId: string;
  propertyId: string;
  applicantId?: string | null;
  offerId?: string;
  status?: TenancyStatus;
  statusBefore?: TenancyStatus;
  statusAfter?: TenancyStatus;
};

function toAuditRole(role: string): "admin" | "superAdmin" {
  if (role === "superAdmin") return "superAdmin";
  return "admin";
}

export function writeTenancyAudit(payload: TenancyAuditPayload): void {
  const bypass = payload.role === "superAdmin";
  const meta: Record<string, unknown> = {
    propertyId: payload.propertyId,
    status: payload.status,
  };
  if (payload.applicantId != null) meta.applicantId = payload.applicantId;
  if (payload.offerId != null) meta.offerId = payload.offerId;
  if (payload.action === "TENANCY_STATUS_UPDATED") {
    meta.before = payload.statusBefore;
    meta.after = payload.statusAfter;
  }

  writeAuditLog({
    action: payload.action,
    actorUid: payload.actorUid,
    actorRole: toAuditRole(payload.role),
    actorAgencyId: payload.actorAgencyId,
    targetType: "tenancy",
    targetId: payload.tenancyId,
    agencyId: payload.agencyId,
    meta,
    bypass,
  });
}
