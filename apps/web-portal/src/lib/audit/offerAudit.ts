/**
 * Server-only: audit log entries for offer create/update/status change.
 * Uses unified writeAuditLog. Actions: OFFER_CREATED, OFFER_UPDATED, OFFER_STATUS_UPDATED.
 */

import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import type { OfferStatus } from "@/lib/types/offer";

export type OfferAuditAction = "OFFER_CREATED" | "OFFER_UPDATED" | "OFFER_STATUS_UPDATED";

export type OfferAuditPayload = {
  action: OfferAuditAction;
  actorUid: string;
  actorAgencyId: string | null;
  role: string;
  offerId: string;
  agencyId: string;
  propertyId: string;
  applicantId?: string | null;
  applicationId?: string | null;
  status?: OfferStatus;
  statusBefore?: OfferStatus;
  statusAfter?: OfferStatus;
};

function toAuditRole(role: string): "admin" | "superAdmin" {
  if (role === "superAdmin") return "superAdmin";
  return "admin";
}

export function writeOfferAudit(payload: OfferAuditPayload): void {
  const bypass = payload.role === "superAdmin";
  let action: string = payload.action;
  const meta: Record<string, unknown> = {
    propertyId: payload.propertyId,
    status: payload.status,
  };
  if (payload.applicantId != null) meta.applicantId = payload.applicantId;
  if (payload.applicationId != null) meta.applicationId = payload.applicationId;

  if (payload.action === "OFFER_STATUS_UPDATED") {
    meta.before = payload.statusBefore;
    meta.after = payload.statusAfter;
  }

  writeAuditLog({
    action,
    actorUid: payload.actorUid,
    actorRole: toAuditRole(payload.role),
    actorAgencyId: payload.actorAgencyId,
    targetType: "offer",
    targetId: payload.offerId,
    agencyId: payload.agencyId,
    meta,
    bypass,
  });
}
