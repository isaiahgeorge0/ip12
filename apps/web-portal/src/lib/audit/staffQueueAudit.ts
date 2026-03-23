/**
 * Audit events for unified staff action queue workflow actions.
 * Uses writeAuditLog. Actions: STAFF_QUEUE_COMPLETED, STAFF_QUEUE_SNOOZED, STAFF_QUEUE_ASSIGNED, STAFF_QUEUE_REOPENED.
 */

import { writeAuditLog } from "@/lib/audit/writeAuditLog";

export type StaffQueueAuditAction =
  | "STAFF_QUEUE_COMPLETED"
  | "STAFF_QUEUE_SNOOZED"
  | "STAFF_QUEUE_ASSIGNED"
  | "STAFF_QUEUE_REOPENED";

export type StaffQueueAuditPayload = {
  action: StaffQueueAuditAction;
  actorUid: string;
  actorRole: "admin" | "superAdmin";
  actorAgencyId: string | null;
  agencyId: string;
  itemId: string;
  itemType: string;
  propertyId: string;
  propertyDisplayLabel?: string | null;
  applicantId?: string | null;
  offerId?: string | null;
  ticketId?: string | null;
  previousStatus?: string | null;
  nextStatus?: string | null;
  assignedToUid?: string | null;
  assignedToName?: string | null;
  snoozedUntil?: number | null;
  completionNote?: string | null;
  bypass?: boolean;
};

export function writeStaffQueueAudit(payload: StaffQueueAuditPayload): void {
  const meta: Record<string, unknown> = {
    itemType: payload.itemType,
    propertyId: payload.propertyId,
    previousStatus: payload.previousStatus ?? undefined,
    nextStatus: payload.nextStatus ?? undefined,
  };
  if (payload.propertyDisplayLabel != null) meta.propertyDisplayLabel = payload.propertyDisplayLabel;
  if (payload.applicantId != null) meta.applicantId = payload.applicantId;
  if (payload.offerId != null) meta.offerId = payload.offerId;
  if (payload.ticketId != null) meta.ticketId = payload.ticketId;
  if (payload.assignedToUid != null) meta.assignedToUid = payload.assignedToUid;
  if (payload.assignedToName != null) meta.assignedToName = payload.assignedToName;
  if (payload.snoozedUntil != null) meta.snoozedUntil = payload.snoozedUntil;
  if (payload.completionNote != null) meta.completionNote = payload.completionNote;

  writeAuditLog({
    action: payload.action,
    actorUid: payload.actorUid,
    actorRole: payload.actorRole,
    actorAgencyId: payload.actorAgencyId,
    targetType: "staff_action_queue",
    targetId: payload.itemId,
    agencyId: payload.agencyId,
    meta,
    bypass: payload.bypass === true,
  });
}
