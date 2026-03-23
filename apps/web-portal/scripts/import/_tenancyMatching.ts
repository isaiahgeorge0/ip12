import { normalizeAddress, type NormalizedAddress } from "./_normalizeAddress";

export type PropertyCandidate = {
  propertyId: string;
  rawCandidateAddress: string;
  displayAddress: string;
  postcode: string | null;
  comparableAddress: string;
  numberToken: string | null;
  type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  normalizedAddress: NormalizedAddress;
};

export type PropertyMatchResult = {
  status: "matched" | "unmatched" | "ambiguous";
  method: "address_exact" | "address_postcode_name" | "manual_review";
  propertyId: string | null;
  candidates: Array<{ propertyId: string; displayAddress: string; postcode: string | null; score: number }>;
  rejectionReason?: string;
};

export type ScoreBreakdown = {
  exactNormalized: boolean;
  exactNoPostcode: boolean;
  exactComparable: boolean;
  postcodeMatch: boolean;
  numberMatch: boolean;
  sharedTokenCount: number;
  score: number;
};

export function scoreCandidateDetailed(
  tenancy: NormalizedAddress,
  p: PropertyCandidate
): ScoreBreakdown {
  const prop = p.normalizedAddress;
  let score = 0;
  const exactNormalized = Boolean(tenancy.normalized && tenancy.normalized === prop.normalized);
  const exactNoPostcode = Boolean(
    tenancy.normalizedNoPostcode && tenancy.normalizedNoPostcode === prop.normalizedNoPostcode
  );
  const exactComparable = Boolean(tenancy.comparable && tenancy.comparable === prop.comparable);
  const postcodeMatch = Boolean(tenancy.postcode && prop.postcode && tenancy.postcode === prop.postcode);
  const numberMatch = Boolean(
    tenancy.numberToken && prop.numberToken && tenancy.numberToken === prop.numberToken
  );

  if (exactNormalized) score += 100;
  if (
    exactNoPostcode
  ) {
    score += 95;
  }
  if (exactComparable) score += 60;
  if (postcodeMatch) score += 40;
  if (numberMatch) score += 20;

  const tSet = new Set(tenancy.tokens);
  const pSet = new Set(prop.tokens);
  let sharedTokenCount = 0;
  for (const t of tSet) {
    if (pSet.has(t)) sharedTokenCount += 1;
  }
  if (sharedTokenCount >= 2) score += Math.min(30, sharedTokenCount * 6);
  return {
    exactNormalized,
    exactNoPostcode,
    exactComparable,
    postcodeMatch,
    numberMatch,
    sharedTokenCount,
    score,
  };
}

export function explainMatchDecision(scored: Array<{ score: number }>): string {
  if (scored.length === 0) return "no_scored_candidates";
  const top = scored[0];
  const second = scored[1];
  if (top.score < 70) return "top_score_below_confidence";
  if (second && second.score > top.score - 8) return "runner_up_too_close";
  return "manual_review_guardrail";
}

export function resolvePropertyMatch(
  tenancyAddressRaw: string | null,
  properties: PropertyCandidate[]
): PropertyMatchResult {
  const tenancyAddress = normalizeAddress(tenancyAddressRaw ?? "");
  if (!tenancyAddress.raw) {
    return {
      status: "unmatched",
      method: "manual_review",
      propertyId: null,
      candidates: [],
    };
  }

  const scoped = tenancyAddress.postcode
    ? properties.filter((p) => p.postcode && p.postcode === tenancyAddress.postcode)
    : properties;
  const pool = scoped.length > 0 ? scoped : properties;

  const scored = pool
    .map((p) => {
      const detail = scoreCandidateDetailed(tenancyAddress, p);
      return { p, score: detail.score, detail };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      status: "unmatched",
      method: "manual_review",
      propertyId: null,
      candidates: [],
    };
  }

  const top = scored[0];
  const second = scored[1];
  const hasStrongSignals =
    top.detail.postcodeMatch &&
    top.detail.numberMatch &&
    top.detail.sharedTokenCount >= 2;
  const confidentUnique =
    top.score >= 90 ||
    (top.score >= 70 && hasStrongSignals && (!second || second.score <= top.score - 8));
  if (confidentUnique) {
    const method =
      top.detail.exactNormalized || top.detail.exactNoPostcode || top.detail.exactComparable
        ? "address_exact"
        : "address_postcode_name";
    return {
      status: "matched",
      method,
      propertyId: top.p.propertyId,
      candidates: [
        {
          propertyId: top.p.propertyId,
          displayAddress: top.p.displayAddress,
          postcode: top.p.postcode,
          score: top.score,
        },
      ],
    };
  }

  const candidateList = scored.slice(0, 5).map(({ p, score }) => ({
    propertyId: p.propertyId,
    displayAddress: p.displayAddress,
    postcode: p.postcode,
    score,
  }));
  return {
    status: "ambiguous",
    method: "manual_review",
    propertyId: null,
    candidates: candidateList,
    rejectionReason: explainMatchDecision(scored),
  };
}

