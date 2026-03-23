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

/** Global applicant profile keyed by userId. Reusable across enquiries; written by server on enquiry submit. */
export function applicantDoc(userId: string): string {
  return `applicants/${userId}`;
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

/** Enquiries from public listing / applicant pipeline. Agency-scoped. */
export function enquiriesCol(agencyId: string): string {
  return `agencies/${agencyId}/enquiries`;
}

/** Viewings: agency-scoped property viewings (booked, completed, etc.). */
export function viewingsCol(agencyId: string): string {
  return `agencies/${agencyId}/viewings`;
}

export function viewingDoc(agencyId: string, viewingId: string): string {
  return `${viewingsCol(agencyId)}/${viewingId}`;
}

/** Applicant-facing portal messages (e.g. proceed prompt). Agency-scoped; recipientUserId for inbox. */
export function portalMessagesCol(agencyId: string): string {
  return `agencies/${agencyId}/portalMessages`;
}

/** Application pipeline: operational workflow layer for proceed-prompt / ready-to-apply / application-created. */
export function applicationPipelineCol(agencyId: string): string {
  return `agencies/${agencyId}/applicationPipeline`;
}

export function applicationPipelineDoc(agencyId: string, pipelineItemId: string): string {
  return `${applicationPipelineCol(agencyId)}/${pipelineItemId}`;
}

export function tenanciesCol(agencyId: string): string {
  return `agencies/${agencyId}/tenancies`;
}

export function ticketsCol(agencyId: string): string {
  return `agencies/${agencyId}/tickets`;
}

/** Offers: agency-scoped tenancy/rental offers (draft, sent, accepted, etc.). */
export function offersCol(agencyId: string): string {
  return `agencies/${agencyId}/offers`;
}

/** Staff action queue: accepted offers needing staff handoff. API-only write. */
export function staffActionQueueCol(agencyId: string): string {
  return `agencies/${agencyId}/staffActionQueue`;
}

/** Unified queue workflow state overlay: open/snoozed/completed, assignment, etc. Doc id = unified item id (e.g. offer_xxx). */
export function staffActionQueueStateCol(agencyId: string): string {
  return `agencies/${agencyId}/staffActionQueueState`;
}

export function staffActionQueueStateDoc(agencyId: string, itemId: string): string {
  return `${staffActionQueueStateCol(agencyId)}/${itemId}`;
}

/** Notes subcollection under a ticket. */
export function ticketNotesCol(agencyId: string, ticketId: string): string {
  return `agencies/${agencyId}/tickets/${ticketId}/notes`;
}

export function contractorJobsCol(agencyId: string): string {
  return `agencies/${agencyId}/contractorJobs`;
}

/** Contractors (maintenance partners). Agency-scoped. */
export function contractorsCol(agencyId: string): string {
  return `agencies/${agencyId}/contractors`;
}

export function contractorDoc(agencyId: string, contractorId: string): string {
  return `${contractorsCol(agencyId)}/${contractorId}`;
}

/** Maintenance jobs (contractor assignments from tickets). Agency-scoped. */
export function jobsCol(agencyId: string): string {
  return `agencies/${agencyId}/jobs`;
}

export function jobDoc(agencyId: string, jobId: string): string {
  return `${jobsCol(agencyId)}/${jobId}`;
}

/** Maintenance / repair requests. Agency-scoped; linked to property and tenancy. */
export function maintenanceRequestsCol(agencyId: string): string {
  return `agencies/${agencyId}/maintenanceRequests`;
}

/** Rent payments. Agency-scoped; linked to tenancy and property. */
export function rentPaymentsCol(agencyId: string): string {
  return `agencies/${agencyId}/rentPayments`;
}

export function rentPaymentDoc(agencyId: string, paymentId: string): string {
  return `${rentPaymentsCol(agencyId)}/${paymentId}`;
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

/** Global property index for map search / filtering. Doc id: {agencyId}__{propertyId}. */
export const PROPERTY_INDEX_COLLECTION = "propertyIndex";

export function propertyIndexDocId(agencyId: string, propertyId: string): string {
  return `${agencyId}__${propertyId}`;
}
