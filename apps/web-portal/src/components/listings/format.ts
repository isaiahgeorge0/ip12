import type { PropertySearchHit } from "./types";

export function formatGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function primaryPriceLabel(hit: PropertySearchHit): string | null {
  if (typeof hit.price === "number" && Number.isFinite(hit.price)) return formatGBP(hit.price);
  if (typeof hit.rent === "number" && Number.isFinite(hit.rent)) return `${formatGBP(hit.rent)}/month`;
  return null;
}

export function bedsBathsLabel(hit: PropertySearchHit): string {
  const beds = typeof hit.beds === "number" ? hit.beds : null;
  const baths = typeof hit.baths === "number" ? hit.baths : null;
  const parts: string[] = [];
  if (beds != null) parts.push(`${beds} bed`);
  if (baths != null) parts.push(`${baths} bath`);
  return parts.join(" · ");
}

