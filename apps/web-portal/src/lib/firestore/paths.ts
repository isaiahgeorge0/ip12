/**
 * Firestore collection and document path helpers.
 * All paths are relative to the project root; use with Firestore refs.
 */

export function systemBootstrapDoc(): string {
  return "system/bootstrap";
}

export function userDoc(uid: string): string {
  return `users/${uid}`;
}

export function agencyDoc(agencyId: string): string {
  return `agencies/${agencyId}`;
}

export function propertiesCol(agencyId: string): string {
  return `agencies/${agencyId}/properties`;
}

export function applicationsCol(agencyId: string): string {
  return `agencies/${agencyId}/applications`;
}

export function tenanciesCol(agencyId: string): string {
  return `agencies/${agencyId}/tenancies`;
}

export function ticketsCol(agencyId: string): string {
  return `agencies/${agencyId}/tickets`;
}

/** Notes subcollection under a ticket. */
export function ticketNotesCol(agencyId: string, ticketId: string): string {
  return `agencies/${agencyId}/tickets/${ticketId}/notes`;
}

export function contractorJobsCol(agencyId: string): string {
  return `agencies/${agencyId}/contractorJobs`;
}

/** Join collection: landlordUid -> propertyId + agencyId. */
export function propertyLandlordsCol(): string {
  return "propertyLandlords";
}

/** Grants: which agencies can view a landlord's full cross-agency inventory. Doc id = landlordUid. */
export function landlordAgencyGrantsCol(): string {
  return "landlordAgencyGrants";
}

export function landlordAgencyGrantDoc(landlordUid: string): string {
  return `${landlordAgencyGrantsCol()}/${landlordUid}`;
}
