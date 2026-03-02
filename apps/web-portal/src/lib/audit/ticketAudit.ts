/**
 * Server-only: audit log entries for ticket create/update/status change/notes.
 * Uses unified writeAuditLog. Actions: TICKET_CREATED_BY_LANDLORD, TICKET_CREATED_BY_ADMIN,
 * TICKET_STATUS_CHANGED, TICKET_NOTE_ADDED.
 */

import { writeAuditLog } from "@/lib/audit/writeAuditLog";

export type TicketAuditAction =
  | "TICKET_CREATED"
  | "TICKET_STATUS_CHANGED"
  | "TICKET_UPDATED"
  | "TICKET_NOTE_ADDED";

export type TicketAuditPayload = {
  action: TicketAuditAction;
  actorUid: string;
  actorAgencyId: string | null;
  role: string;
  ticketId: string;
  agencyId: string;
  propertyId: string;
  landlordUid: string;
  status?: string;
  statusBefore?: string;
  statusAfter?: string;
  noteId?: string;
  noteTextLength?: number;
  createdAt?: unknown;
};

function toAuditRole(role: string): "admin" | "superAdmin" | "landlord" {
  if (role === "superAdmin") return "superAdmin";
  if (role === "landlord") return "landlord";
  return "admin";
}

export function writeTicketAudit(payload: Omit<TicketAuditPayload, "createdAt">): void {
  const bypass = payload.role === "superAdmin";
  let action: string;
  let meta: Record<string, unknown> = {
    propertyId: payload.propertyId,
    landlordUid: payload.landlordUid,
    status: payload.status,
  };

  if (payload.action === "TICKET_CREATED") {
    action = payload.role === "landlord" ? "TICKET_CREATED_BY_LANDLORD" : "TICKET_CREATED_BY_ADMIN";
  } else if (payload.action === "TICKET_STATUS_CHANGED") {
    action = "TICKET_STATUS_CHANGED";
    meta = { before: payload.statusBefore, after: payload.statusAfter };
  } else if (payload.action === "TICKET_NOTE_ADDED") {
    action = "TICKET_NOTE_ADDED";
    meta = { noteLength: payload.noteTextLength ?? 0 };
  } else {
    action = payload.action;
  }

  writeAuditLog({
    action,
    actorUid: payload.actorUid,
    actorRole: toAuditRole(payload.role),
    actorAgencyId: payload.actorAgencyId,
    targetType: "ticket",
    targetId: payload.ticketId,
    agencyId: payload.agencyId,
    meta,
    bypass,
  });
}
