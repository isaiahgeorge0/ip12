/**
 * Application form fields for the canonical application document.
 * Used by portal PATCH and form UI. All fields optional except when submitting.
 */

export const APPLICATION_PROGRESS_STATUSES = ["draft", "in_progress", "submitted"] as const;
export type ApplicationProgressStatus = (typeof APPLICATION_PROGRESS_STATUSES)[number];

export type ApplicationFormFields = {
  fullName?: string;
  email?: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  currentAddressLine1?: string | null;
  currentAddressLine2?: string | null;
  currentCity?: string | null;
  currentPostcode?: string | null;
  reasonForMoving?: string | null;
  intendedOccupants?: number | null;
  hasChildren?: boolean | null;
  hasPets?: boolean | null;
  petDetails?: string | null;
  smoker?: boolean | null;
  moveInDate?: string | null;
  employmentStatus?: string | null;
  employerName?: string | null;
  jobTitle?: string | null;
  monthlyIncome?: number | null;
  annualIncome?: number | null;
  additionalIncomeNotes?: string | null;
  guarantorRequired?: boolean | null;
  guarantorOffered?: boolean | null;
  guarantorNotes?: string | null;
  affordabilityNotes?: string | null;
  extraNotes?: string | null;
  applicationProgressStatus?: ApplicationProgressStatus;
  submittedAt?: unknown;
  lastEditedAt?: unknown;
};
