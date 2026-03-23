/**
 * Contractor (maintenance partner) types for admin contractor management.
 * Firestore: agencies/{agencyId}/contractors/{contractorId}
 */

export type ContractorDoc = {
  agencyId: string;
  displayName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  trade: string | null;
  skills: string[];
  coverageAreas: string[];
  isActive: boolean;
  notes: string | null;
  createdAt: unknown;
  updatedAt: unknown;
  createdBy: string;
  updatedBy: string;
};

export type ContractorListItem = {
  id: string;
  agencyId: string;
  displayName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  trade: string | null;
  skills: string[];
  coverageAreas: string[];
  isActive: boolean;
  notes: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  jobsCount?: number;
};

/** Common trades for maintenance / contractors */
export const CONTRACTOR_TRADES = [
  "Plumbing",
  "Electrical",
  "HVAC",
  "Carpentry",
  "Painting",
  "General",
  "Cleaning",
  "Landscaping",
  "Locks",
  "Appliances",
  "Other",
] as const;

export type ContractorTrade = (typeof CONTRACTOR_TRADES)[number];

export function isContractorTrade(s: unknown): s is ContractorTrade {
  return typeof s === "string" && (CONTRACTOR_TRADES as readonly string[]).includes(s);
}
