/**
 * Rule-based matching: score an applicant (with preferences) against a property.
 * Deterministic, explainable, 0–100 score with reasons and warnings.
 * Used by both "recommended properties for applicant" and "recommended applicants for property".
 */

import type { ApplicantPreferences } from "@/lib/types/applicantPreferences";
import { normalizeApplicantPreferences } from "@/lib/types/applicantPreferences";

export type PropertyForMatching = {
  id: string;
  displayAddress: string;
  postcode?: string;
  type?: string;
  bedrooms?: number;
  rentPcm?: number | null;
  /** If the platform supports sale/rent; omit = assume rent. */
  listingType?: "rent" | "sale" | null;
};

export type ApplicantForMatching = {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string | null;
  /** Preferences; raw doc.preferences passed through normalizeApplicantPreferences. */
  preferences?: unknown;
};

export type MatchResult = {
  score: number;
  reasons: string[];
  warnings: string[];
  matched: boolean;
};

const MIN_SCORE_TO_SURFACE = 40;
const MAX_SCORE = 100;

/** Weights (must sum to 100 or we clamp). */
const W_LOOKING_FOR = 15;
const W_BUDGET = 25;
const W_BEDROOMS = 20;
const W_AREA = 20;
const W_PROPERTY_TYPE = 15;
const W_PETS_PARKING = 5;

function clampScore(n: number): number {
  return Math.max(0, Math.min(MAX_SCORE, Math.round(n)));
}

/**
 * Score one applicant–property pair.
 * Property price: use rentPcm for rent (pcm); if listingType is sale we could use a price field later.
 */
export function scoreApplicantToProperty(
  applicant: ApplicantForMatching,
  property: PropertyForMatching
): MatchResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  const prefs = normalizeApplicantPreferences(applicant.preferences);
  const propRent = property.rentPcm != null && Number.isFinite(property.rentPcm) ? property.rentPcm : null;
  const propType = (property.type ?? "").trim();
  const propBedrooms = typeof property.bedrooms === "number" && Number.isFinite(property.bedrooms) ? property.bedrooms : null;
  const searchText = [property.displayAddress, property.postcode].filter(Boolean).join(" ").toLowerCase();

  // 1. LookingFor: rent/sale/both. Phase 1 assume property is rent unless listingType set.
  const listingType = property.listingType ?? "rent";
  if (prefs.lookingFor) {
    const ok =
      prefs.lookingFor === "both" ||
      (prefs.lookingFor === "rent" && listingType === "rent") ||
      (prefs.lookingFor === "sale" && listingType === "sale");
    if (ok) {
      score += W_LOOKING_FOR;
      reasons.push(prefs.lookingFor === "both" ? "Open to rent or sale" : `Looking for ${prefs.lookingFor}`);
    } else {
      warnings.push(`Applicant is looking for ${prefs.lookingFor}; property is ${listingType}`);
    }
  } else {
    score += W_LOOKING_FOR * 0.5; // neutral
  }

  // 2. Budget (rent pcm)
  if (prefs.budgetMin != null || prefs.budgetMax != null) {
    const min = prefs.budgetMin ?? 0;
    const max = prefs.budgetMax ?? Number.POSITIVE_INFINITY;
    if (propRent != null) {
      if (propRent >= min && propRent <= max) {
        score += W_BUDGET;
        reasons.push("Budget fits the asking rent");
      } else if (propRent > max) {
        warnings.push("Price is above stated budget");
        score += Math.max(0, W_BUDGET * 0.3);
      } else if (propRent < min) {
        score += W_BUDGET * 0.6; // under budget is usually fine
        reasons.push("Rent below stated minimum budget");
      }
    }
  } else {
    score += W_BUDGET * 0.5; // no budget data = neutral
  }

  // 3. Bedrooms
  if ((prefs.minBedrooms != null || prefs.maxBedrooms != null) && propBedrooms != null) {
    const minB = prefs.minBedrooms ?? 0;
    const maxB = prefs.maxBedrooms ?? 99;
    if (propBedrooms >= minB && propBedrooms <= maxB) {
      score += W_BEDROOMS;
      reasons.push(
        minB === maxB ? `${minB} bedroom(s)` : `Bedrooms in range (${minB}–${maxB})`
      );
    } else if (propBedrooms < minB) {
      warnings.push("Fewer bedrooms than stated minimum");
      score += W_BEDROOMS * 0.2;
    } else {
      warnings.push("More bedrooms than stated maximum");
      score += W_BEDROOMS * 0.3;
    }
  } else if (prefs.minBedrooms != null && propBedrooms != null && propBedrooms >= prefs.minBedrooms) {
    score += W_BEDROOMS * 0.8;
    reasons.push(`Looking for ${prefs.minBedrooms}+ bedroom(s)`);
  } else {
    score += W_BEDROOMS * 0.5;
  }

  // 4. Preferred area (substring match on address/postcode)
  if (prefs.preferredAreas.length > 0 && searchText) {
    const matched = prefs.preferredAreas.some((area) =>
      area.toLowerCase().trim().length > 0 && searchText.includes(area.toLowerCase().trim())
    );
    if (matched) {
      score += W_AREA;
      const matchedArea = prefs.preferredAreas.find((area) =>
        searchText.includes(area.toLowerCase().trim())
      );
      reasons.push(`Preferred area includes ${matchedArea ?? "location"}`);
    }
  } else {
    score += W_AREA * 0.5;
  }

  // 5. Property type
  if (prefs.propertyTypes.length > 0 && propType) {
    const normPropType = propType.toLowerCase();
    const matched = prefs.propertyTypes.some(
      (t) => t.toLowerCase().trim() === normPropType || normPropType.includes(t.toLowerCase().trim())
    );
    if (matched) {
      score += W_PROPERTY_TYPE;
      reasons.push(`Property type: ${propType}`);
    }
  } else {
    score += W_PROPERTY_TYPE * 0.5;
  }

  // 6. Pets / parking (optional; property would need hasPetsAllowed / parking fields for full support)
  if (prefs.hasPets === true) {
    reasons.push("Applicant has pets");
    score += W_PETS_PARKING * 0.5; // neutral until property supports pets allowed
  }
  if (prefs.needsParking === true) {
    if (searchText.includes("parking") || searchText.includes("garage") || searchText.includes("drive")) {
      score += W_PETS_PARKING;
      reasons.push("Parking mentioned");
    } else {
      score += W_PETS_PARKING * 0.5;
    }
  }

  const total = clampScore(score);
  return {
    score: total,
    reasons,
    warnings,
    matched: total >= MIN_SCORE_TO_SURFACE,
  };
}
