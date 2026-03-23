/**
 * Server-only: audit log entries for contractor create/update/status.
 * Uses unified writeAuditLog.
 */

import { writeAuditLog } from "@/lib/audit/writeAuditLog";

export type ContractorAuditAction =
  | "CONTRACTOR_CREATED"
  | "CONTRACTOR_UPDATED"
  | "CONTRACTOR_STATUS_UPDATED";

export type ContractorAuditPayload = {
  action: ContractorAuditAction;
  actorUid: string;
  actorAgencyId: string | null;
  role: string;
  contractorId: string;
  agencyId: string;
  contractorName?: string;
  isActive?: boolean;
  previousStatus?: boolean;
  nextStatus?: boolean;
};

function toAuditRole(role: string): "admin" | "superAdmin" {
  if (role === "superAdmin") return "superAdmin";
  return "admin";
}

export function writeContractorAudit(payload: ContractorAuditPayload): void {
  const bypass = payload.role === "superAdmin";
  const meta: Record<string, unknown> = {};
  if (payload.contractorName != null) meta.contractorName = payload.contractorName;
  if (payload.isActive != null) meta.isActive = payload.isActive;
  if (payload.action === "CONTRACTOR_STATUS_UPDATED") {
    meta.before = payload.previousStatus;
    meta.after = payload.nextStatus;
  }

  writeAuditLog({
    action: payload.action,
    actorUid: payload.actorUid,
    actorRole: toAuditRole(payload.role),
    actorAgencyId: payload.actorAgencyId,
    targetType: "contractor",
    targetId: payload.contractorId,
    agencyId: payload.agencyId,
    meta: Object.keys(meta).length ? meta : undefined,
    bypass,
  });
}
