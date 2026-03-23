/**
 * Derives a stable tenant ID from a tenancy record for grouping.
 * Used to build tenant views from tenancy data without a dedicated tenant collection.
 */

export type TenancyForTenantId = {
  id: string;
  applicantId?: string | null;
  applicantUserId?: string | null;
  tenantEmail?: string | null;
};

/**
 * Deterministic tenant ID:
 * - applicantId → "applicant:" + applicantId
 * - else applicantUserId → "user:" + applicantUserId
 * - else tenantEmail → "email:" + lowercased trimmed email
 * - else → "tenancy:" + tenancy.id
 */
export function deriveTenantId(tenancy: TenancyForTenantId): string {
  if (tenancy.applicantId != null && String(tenancy.applicantId).trim()) {
    return "applicant:" + String(tenancy.applicantId).trim();
  }
  if (tenancy.applicantUserId != null && String(tenancy.applicantUserId).trim()) {
    return "user:" + String(tenancy.applicantUserId).trim();
  }
  if (tenancy.tenantEmail != null && String(tenancy.tenantEmail).trim()) {
    return "email:" + String(tenancy.tenantEmail).trim().toLowerCase();
  }
  return "tenancy:" + tenancy.id;
}
