/**
 * Applicant profile: reusable CRM record keyed by userId.
 * Stable fields reused across enquiries; property-specific data stays on enquiry docs.
 */

export const EMPLOYMENT_STATUSES = [
  "full_time",
  "part_time",
  "self_employed",
  "unemployed",
  "student",
  "retired",
  "other",
] as const;

export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export interface ApplicantProfile {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  hasPets: boolean | null;
  petDetails: string | null;
  hasChildren: boolean | null;
  employmentStatus: EmploymentStatus | null;
  incomeNotes: string | null;
  smoker: boolean | null;
  intendedOccupants: number | null;
  createdAt: unknown;
  updatedAt: unknown;
}

export type ApplicantProfileUpdate = Omit<
  Partial<ApplicantProfile>,
  "userId" | "createdAt" | "updatedAt"
>;
