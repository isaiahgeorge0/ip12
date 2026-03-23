/**
 * Offer document and API types.
 * Collection: agencies/{agencyId}/offers/{offerId}
 */

export type OfferStatus = "draft" | "sent" | "accepted" | "rejected" | "withdrawn";
export type OfferSource = "manual" | "application";

export const OFFER_STATUSES: OfferStatus[] = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "withdrawn",
];

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const OFFER_SOURCE_LABELS: Record<OfferSource, string> = {
  manual: "Manual",
  application: "Application",
};

export type OfferDoc = {
  agencyId: string;
  applicantId: string | null;
  applicantUserId: string | null;
  applicationId: string | null;
  propertyId: string;
  propertyDisplayLabel: string;
  amount: number;
  currency: "GBP";
  /** Deposit amount (optional). */
  deposit?: number | null;
  /** Move-in date ISO string (optional). */
  moveInDate?: string | null;
  status: OfferStatus;
  notes: string | null;
  source: OfferSource;
  /** Set when status becomes "sent". */
  sentAt?: unknown;
  createdAt: unknown;
  updatedAt: unknown;
  createdBy: string;
  updatedBy: string;
};
