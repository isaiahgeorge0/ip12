/**
 * Applicant property preferences for matching.
 * Stored under applicant/application doc (e.g. preferences field).
 * All fields optional; missing = null/empty for neutral matching.
 */

export const LOOKING_FOR_OPTIONS = ["rent", "sale", "both"] as const;
export type LookingFor = (typeof LOOKING_FOR_OPTIONS)[number];

/** Common property types aligned with admin property type field. */
export const PREFERRED_PROPERTY_TYPES = ["House", "Flat", "Studio", "Other"] as const;
export type PreferredPropertyType = (typeof PREFERRED_PROPERTY_TYPES)[number];

export type ApplicantPreferences = {
  lookingFor: LookingFor | null;
  budgetMin: number | null;
  budgetMax: number | null;
  minBedrooms: number | null;
  maxBedrooms: number | null;
  preferredAreas: string[];
  propertyTypes: string[];
  hasPets: boolean | null;
  needsParking: boolean | null;
  moveInWindow: string | null;
  notes: string | null;
};

export const DEFAULT_APPLICANT_PREFERENCES: ApplicantPreferences = {
  lookingFor: null,
  budgetMin: null,
  budgetMax: null,
  minBedrooms: null,
  maxBedrooms: null,
  preferredAreas: [],
  propertyTypes: [],
  hasPets: null,
  needsParking: null,
  moveInWindow: null,
  notes: null,
};

function safeNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function safeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
}

/** Normalize raw doc.preferences into ApplicantPreferences. */
export function normalizeApplicantPreferences(data: unknown): ApplicantPreferences {
  if (data == null || typeof data !== "object") return { ...DEFAULT_APPLICANT_PREFERENCES };
  const d = data as Record<string, unknown>;
  const lookingFor = d.lookingFor;
  const lookingForVal =
    typeof lookingFor === "string" && (LOOKING_FOR_OPTIONS as readonly string[]).includes(lookingFor)
      ? (lookingFor as LookingFor)
      : null;
  return {
    lookingFor: lookingForVal,
    budgetMin: safeNumber(d.budgetMin),
    budgetMax: safeNumber(d.budgetMax),
    minBedrooms: safeNumber(d.minBedrooms),
    maxBedrooms: safeNumber(d.maxBedrooms),
    preferredAreas: safeStringArray(d.preferredAreas),
    propertyTypes: safeStringArray(d.propertyTypes),
    hasPets: typeof d.hasPets === "boolean" ? d.hasPets : null,
    needsParking: typeof d.needsParking === "boolean" ? d.needsParking : null,
    moveInWindow: typeof d.moveInWindow === "string" ? d.moveInWindow.trim() || null : null,
    notes: typeof d.notes === "string" ? d.notes.trim() || null : null,
  };
}
