/**
 * Staff action queue: workflow layer for accepted offers needing staff handoff.
 * Collection: agencies/{agencyId}/staffActionQueue/{queueItemId}.
 * Canonical offer remains in offers; canonical application in applications.
 */

export const STAFF_ACTION_QUEUE_STAGES = [
  "offer_accepted",
  "picked_up",
  "referencing_sent",
  "docs_sent",
  "moved_to_external_system",
  "completed",
  "archived",
] as const;

export type StaffActionQueueStage = (typeof STAFF_ACTION_QUEUE_STAGES)[number];

export const STAFF_ACTION_QUEUE_STAGE_LABELS: Record<StaffActionQueueStage, string> = {
  offer_accepted: "Offer accepted",
  picked_up: "Picked up",
  referencing_sent: "Referencing sent",
  docs_sent: "Docs sent",
  moved_to_external_system: "Moved to external system",
  completed: "Completed",
  archived: "Archived",
};

export type StaffActionQueueSource = "offer_accept";

export type StaffActionQueueItemDoc = {
  agencyId: string;
  offerId: string;
  applicationId: string | null;
  applicantId: string | null;
  applicantUserId: string | null;
  propertyId: string;
  propertyDisplayLabel: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  offerAmount: number;
  currency: "GBP";
  stage: StaffActionQueueStage;
  statusLabel?: string;
  source: StaffActionQueueSource;
  notes: string | null;
  acceptedAt: unknown;
  createdAt: unknown;
  updatedAt: unknown;
  lastActionAt: unknown;
  createdBy: string;
  updatedBy: string;
  tenancyId?: string | null;
};

export function isStaffActionQueueStage(s: unknown): s is StaffActionQueueStage {
  return typeof s === "string" && (STAFF_ACTION_QUEUE_STAGES as readonly string[]).includes(s);
}
