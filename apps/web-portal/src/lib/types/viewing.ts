/**
 * Viewing workflow: status and source enums, shared types.
 * Agency-scoped viewings at agencies/{agencyId}/viewings/{viewingId}.
 */

export const VIEWING_STATUSES = [
  "requested",
  "booked",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type ViewingStatus = (typeof VIEWING_STATUSES)[number];

export const DEFAULT_VIEWING_STATUS: ViewingStatus = "booked";

export function isViewingStatus(s: unknown): s is ViewingStatus {
  return typeof s === "string" && (VIEWING_STATUSES as readonly string[]).includes(s);
}

export function normaliseViewingStatus(s: unknown): ViewingStatus {
  return isViewingStatus(s) ? s : DEFAULT_VIEWING_STATUS;
}

export const VIEWING_SOURCES = ["enquiry", "manual"] as const;
export type ViewingSource = (typeof VIEWING_SOURCES)[number];

export function isViewingSource(s: unknown): s is ViewingSource {
  return typeof s === "string" && (VIEWING_SOURCES as readonly string[]).includes(s);
}

/** Labels for admin UI. */
export const VIEWING_STATUS_LABELS: Record<ViewingStatus, string> = {
  requested: "Requested",
  booked: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

export const VIEWING_SOURCE_LABELS: Record<ViewingSource, string> = {
  enquiry: "Enquiry",
  manual: "Manual",
};
