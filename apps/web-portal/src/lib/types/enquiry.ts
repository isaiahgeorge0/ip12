/**
 * Enquiry workflow: status enum and shared types.
 * Used by POST /api/enquiries, PATCH /api/admin/enquiries/[id], and admin UI.
 */

export const ENQUIRY_STATUSES = [
  "new",
  "contacted",
  "viewing_booked",
  "viewing_complete",
  "application_requested",
  "application_received",
  "rejected",
  "archived",
] as const;

export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const DEFAULT_ENQUIRY_STATUS: EnquiryStatus = "new";

export function isEnquiryStatus(s: unknown): s is EnquiryStatus {
  return typeof s === "string" && (ENQUIRY_STATUSES as readonly string[]).includes(s);
}

export function normaliseEnquiryStatus(s: unknown): EnquiryStatus {
  return isEnquiryStatus(s) ? s : DEFAULT_ENQUIRY_STATUS;
}

/** Labels for admin UI. */
export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  viewing_booked: "Viewing booked",
  viewing_complete: "Viewing complete",
  application_requested: "Application requested",
  application_received: "Application received",
  rejected: "Rejected",
  archived: "Archived",
};
