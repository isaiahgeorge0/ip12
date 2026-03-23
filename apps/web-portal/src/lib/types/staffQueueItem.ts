/**
 * Unified staff action queue item types for the operational dashboard.
 * Used by GET /api/admin/staff-action-queue and /admin/staff-action-queue page.
 */

export const STAFF_QUEUE_ITEM_TYPES = [
  "APPLICATION_REVIEW",
  "VIEWING_FOLLOW_UP",
  "PREPARE_OFFER",
  "CREATE_TENANCY",
  "UPCOMING_MOVE_IN",
  "OPEN_TICKET",
  "OFFER_ACCEPTED",
  "TENANCY_MOVE_IN",
  "MAINTENANCE_TICKET_OPEN",
  "DOCUMENT_SIGNATURE_PENDING",
] as const;

export type StaffQueueItemType = (typeof STAFF_QUEUE_ITEM_TYPES)[number];

export const STAFF_QUEUE_PRIORITIES = ["urgent", "high", "normal"] as const;

export type StaffQueuePriority = (typeof STAFF_QUEUE_PRIORITIES)[number];

/** Workflow state for triage: open, snoozed, or completed. */
export const QUEUE_WORKFLOW_STATUSES = ["open", "snoozed", "completed"] as const;

export type QueueWorkflowStatus = (typeof QUEUE_WORKFLOW_STATUSES)[number];

export type StaffActionQueueItem = {
  id: string;
  type: StaffQueueItemType;
  title: string;
  description: string;
  createdAt: number | null;
  propertyId: string;
  propertyDisplayLabel: string;
  applicantId: string | null;
  ticketId: string | null;
  offerId: string | null;
  /** Queue row id for OFFER_ACCEPTED (for PATCH stage) */
  queueItemId: string | null;
  priority: StaffQueuePriority;
  /** Source status (stage, ticket status, etc.) */
  status: string;
  /** Optional: applicant name for display */
  applicantName?: string | null;
  /** Optional: for OFFER_ACCEPTED, current stage */
  stage?: string | null;
  /** Triage workflow state; default "open" when no state doc */
  workflowStatus: QueueWorkflowStatus;
  assignedToUid: string | null;
  assignedToName: string | null;
  snoozedUntil: number | null;
  completedAt: number | null;
  completedByUid: string | null;
  completionNote: string | null;
  /** Optional: short "why this needs attention" for workflow-generated items */
  reasonWhy?: string | null;
};

export const STAFF_QUEUE_ITEM_TYPE_LABELS: Record<StaffQueueItemType, string> = {
  APPLICATION_REVIEW: "Application review",
  VIEWING_FOLLOW_UP: "Viewing follow-up",
  PREPARE_OFFER: "Prepare offer",
  CREATE_TENANCY: "Create tenancy",
  UPCOMING_MOVE_IN: "Upcoming move-in",
  OPEN_TICKET: "Open ticket",
  OFFER_ACCEPTED: "Offer accepted",
  TENANCY_MOVE_IN: "Move-in approaching",
  MAINTENANCE_TICKET_OPEN: "Open maintenance ticket",
  DOCUMENT_SIGNATURE_PENDING: "Document signature",
};
