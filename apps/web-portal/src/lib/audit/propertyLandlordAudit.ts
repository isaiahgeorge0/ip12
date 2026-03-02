/**
 * Server-only: audit log entries for property-landlord assign/unassign.
 * Uses unified writeAuditLog; actions: LANDLORD_ASSIGNED_TO_PROPERTY, LANDLORD_UNASSIGNED_FROM_PROPERTY.
 */

import { writeAuditLog } from "@/lib/audit/writeAuditLog";

export type PropertyLandlordAuditAction =
  | "PROPERTY_LANDLORD_ASSIGNED"
  | "PROPERTY_LANDLORD_UNASSIGNED";

export type PropertyLandlordAuditPayload = {
  action: PropertyLandlordAuditAction;
  actorUid: string;
  actorRole: string;
  actorAgencyId: string | null;
  landlordUid: string;
  propertyId: string;
  agencyId: string;
  /** When actorRole is superAdmin (bypass): primary agency of the landlord. */
  landlordPrimaryAgencyId?: string | null;
  /** When bypass: agency of the join doc / target of the mutation. */
  targetAgencyId?: string | null;
};

function joinId(agencyId: string, propertyId: string, landlordUid: string): string {
  return `${agencyId}_${propertyId}_${landlordUid}`;
}

export function writePropertyLandlordAudit(
  payload: Omit<PropertyLandlordAuditPayload, "createdAt">
): void {
  const action =
    payload.action === "PROPERTY_LANDLORD_ASSIGNED"
      ? "LANDLORD_ASSIGNED_TO_PROPERTY"
      : "LANDLORD_UNASSIGNED_FROM_PROPERTY";
  const targetId = joinId(payload.agencyId, payload.propertyId, payload.landlordUid);
  const bypass = payload.actorRole === "superAdmin";
  writeAuditLog({
    action,
    actorUid: payload.actorUid,
    actorRole: payload.actorRole === "superAdmin" ? "superAdmin" : "admin",
    actorAgencyId: payload.actorAgencyId,
    targetType: "assignment",
    targetId,
    agencyId: payload.agencyId,
    meta: {
      propertyId: payload.propertyId,
      landlordUid: payload.landlordUid,
      actingAgencyId: payload.agencyId,
      landlordPrimaryAgencyId: payload.landlordPrimaryAgencyId ?? undefined,
    },
    bypass,
  });
}
