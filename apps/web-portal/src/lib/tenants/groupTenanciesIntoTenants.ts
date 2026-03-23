/**
 * Groups tenancy records into tenant summaries (derived view, no dedicated tenant collection).
 */

import { deriveTenantId } from "./deriveTenantId";
import type { TenantSummary, TenantDetailTenancyRow } from "@/lib/types/tenancy";
import type { TenancyStatus } from "@/lib/types/tenancy";

export type TenancyRowForGrouping = {
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
  tenancyStartDate: string | null;
  tenancyEndDate: string | null;
  status: TenancyStatus;
  createdAt: number | null;
  updatedAt: number | null;
  notes: string | null;
};

function pickLatest<T>(items: TenancyRowForGrouping[], getValue: (t: TenancyRowForGrouping) => T): T | null {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const v = getValue(sorted[0]);
  if (v == null || (typeof v === "string" && !v.trim())) return null;
  return v;
}

function pickLatestNonEmptyString(items: TenancyRowForGrouping[], key: keyof TenancyRowForGrouping): string {
  for (const t of [...items].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))) {
    const v = t[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/**
 * Groups tenancies by derived tenant ID and returns tenant summaries.
 * Sorted by updatedAt desc.
 */
export function groupTenanciesIntoTenants(tenancies: TenancyRowForGrouping[]): TenantSummary[] {
  const byTenantId = new Map<string, TenancyRowForGrouping[]>();
  for (const t of tenancies) {
    const tenantId = deriveTenantId(t);
    const list = byTenantId.get(tenantId) ?? [];
    list.push(t);
    byTenantId.set(tenantId, list);
  }

  const result: TenantSummary[] = [];
  for (const [tenantId, list] of byTenantId) {
    const sorted = [...list].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    const hasActive = list.some((t) => t.status === "active");
    const status: TenantSummary["status"] = hasActive ? "active" : "former";
    const activeTenancy = list.find((t) => t.status === "active");
    const latestTenancy = sorted[0];
    const earliestCreated = list.reduce((min, t) => {
      const ms = t.createdAt ?? 0;
      return min === null ? ms : Math.min(min, ms);
    }, null as number | null);

    result.push({
      tenantId,
      agencyId: list[0]!.agencyId,
      tenantName: pickLatestNonEmptyString(list, "tenantName") || "—",
      tenantEmail: pickLatestNonEmptyString(list, "tenantEmail") || "—",
      tenantPhone: pickLatest(list, (t) => t.tenantPhone),
      status,
      currentPropertyId: (activeTenancy ?? latestTenancy)?.propertyId ?? null,
      currentPropertyDisplayLabel:
        (activeTenancy ?? latestTenancy)?.propertyDisplayLabel?.trim() || null,
      tenancyCount: list.length,
      activeTenancyId: activeTenancy?.id ?? null,
      latestTenancyId: latestTenancy?.id ?? null,
      applicationId: pickLatest(list, (t) => t.applicationId) ?? null,
      applicantId: pickLatest(list, (t) => t.applicantId) ?? null,
      applicantUserId: pickLatest(list, (t) => t.applicantUserId) ?? null,
      createdAt: earliestCreated,
      updatedAt: latestTenancy?.updatedAt ?? null,
    });
  }

  result.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return result;
}

/**
 * Builds tenant detail: summary + tenancies list for a given tenantId.
 * Returns null if tenantId not found.
 */
export function buildTenantDetail(
  tenancies: TenancyRowForGrouping[],
  tenantId: string
): { tenant: TenantSummary; tenancies: TenantDetailTenancyRow[] } | null {
  const grouped = groupTenanciesIntoTenants(tenancies);
  const tenant = grouped.find((t) => t.tenantId === tenantId);
  if (!tenant) return null;

  const tenantTenancies = tenancies.filter((t) => deriveTenantId(t) === tenantId);
  const sortedTenancies = [...tenantTenancies].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const tenanciesList: TenantDetailTenancyRow[] = sortedTenancies.map((t) => ({
    id: t.id,
    propertyId: t.propertyId,
    propertyDisplayLabel: t.propertyDisplayLabel,
    rentAmount: t.rentAmount,
    currency: t.currency,
    tenancyStartDate: t.tenancyStartDate,
    tenancyEndDate: t.tenancyEndDate,
    status: t.status,
    offerId: t.offerId,
    applicationId: t.applicationId,
    applicantId: t.applicantId,
    applicantUserId: t.applicantUserId,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    notes: t.notes,
  }));

  return { tenant, tenancies: tenanciesList };
}
