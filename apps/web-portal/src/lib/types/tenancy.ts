/**
 * Tenancy record. Collection: agencies/{agencyId}/tenancies/{tenancyId}.
 */

export const TENANCY_STATUSES = ["preparing", "active", "ending", "ended", "cancelled"] as const;
export type TenancyStatus = (typeof TENANCY_STATUSES)[number];

export const TENANCY_STATUS_LABELS: Record<TenancyStatus, string> = {
  preparing: "Preparing",
  active: "Active",
  ending: "Ending",
  ended: "Ended",
  cancelled: "Cancelled",
};

export type TenancyDoc = {
  agencyId: string;
  propertyId: string;
  propertyDisplayLabel: string;
  applicantId: string | null;
  applicantUserId: string | null;
  applicationId: string | null;
  offerId: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string | null;
  rentAmount: number;
  currency: string;
  /** Deposit amount (optional). */
  deposit?: number | null;
  /** Move-in date ISO string (optional). */
  moveInDate?: string | null;
  tenancyStartDate: string | null;
  tenancyEndDate: string | null;
  status: TenancyStatus;
  /** Queue item id when created from queue; empty when created from offer. */
  createdFromQueueItemId: string;
  createdAt: unknown;
  updatedAt: unknown;
  createdBy: string;
  /** Optional operational notes. */
  notes?: string | null;
};

/** Tenancy detail as returned by GET /api/admin/tenancies/[tenancyId] (core + serialized timestamps). */
export type TenancyDetail = {
  id: string;
  agencyId: string;
  propertyId: string;
  propertyDisplayLabel: string;
  applicantId: string | null;
  applicantUserId: string | null;
  applicationId: string | null;
  offerId: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string | null;
  rentAmount: number;
  currency: string;
  deposit: number | null;
  moveInDate: string | null;
  tenancyStartDate: string | null;
  tenancyEndDate: string | null;
  status: TenancyStatus;
  createdFromQueueItemId: string;
  createdAt: number | null;
  updatedAt: number | null;
  createdBy: string;
  notes: string | null;
  /** Optional linked display fields for UI. */
  landlordUid?: string | null;
  landlordName?: string | null;
  propertyStatus?: string | null;
  /** Linked summaries for UI (populated by API when available). */
  linkedProperty?: { id: string; displayLabel: string } | null;
  linkedApplicant?: { id: string; name: string; email: string } | null;
  linkedOffer?: { id: string; amount: number; currency: string; status: string } | null;
  linkedQueue?: { id: string; stage: string } | null;
  linkedLandlord?: { uid: string; displayName: string } | null;
};

/** Tenant status derived from tenancies: active if any tenancy is active, else former. */
export const TENANT_STATUSES = ["active", "former"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

/** Tenant summary derived from grouped tenancy records (no dedicated tenant collection). */
export type TenantSummary = {
  tenantId: string;
  agencyId: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string | null;
  status: TenantStatus;
  currentPropertyId: string | null;
  currentPropertyDisplayLabel: string | null;
  tenancyCount: number;
  activeTenancyId: string | null;
  latestTenancyId: string | null;
  applicationId: string | null;
  applicantId: string | null;
  applicantUserId: string | null;
  createdAt: number | null;
  updatedAt: number | null;
};

/** Single tenancy row as returned in tenant detail tenancies array. */
export type TenantDetailTenancyRow = {
  id: string;
  propertyId: string;
  propertyDisplayLabel: string;
  rentAmount: number;
  currency: string;
  tenancyStartDate: string | null;
  tenancyEndDate: string | null;
  status: TenancyStatus;
  offerId: string;
  applicationId: string | null;
  applicantId: string | null;
  applicantUserId: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  notes: string | null;
};
