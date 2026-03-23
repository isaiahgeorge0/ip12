export type NormalizedAddress = {
  raw: string | null;
  normalized: string;
  normalizedNoPostcode: string;
  comparable: string;
  postcode: string | null;
  numberToken: string | null;
  tokens: string[];
};

const ADDRESS_STOPWORDS = new Set([
  "flat",
  "apt",
  "apartment",
  "unit",
  "the",
  "road",
  "rd",
  "street",
  "st",
  "avenue",
  "ave",
  "close",
  "cl",
  "lane",
  "ln",
  "drive",
  "dr",
  "house",
  "town",
  "city",
  "county",
  "suffolk",
]);

const WORD_NORMALIZATIONS: Array<[RegExp, string]> = [
  [/\broad\b/g, "rd"],
  [/\bstreet\b/g, "st"],
  [/\bavenue\b/g, "ave"],
  [/\bclose\b/g, "cl"],
  [/\blane\b/g, "ln"],
  [/\bdrive\b/g, "dr"],
  [/\bapartment\b/g, "apt"],
];

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function extractUkPostcode(input: string): string | null {
  const m = input
    .toUpperCase()
    .match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/);
  if (!m) return null;
  return `${m[1]} ${m[2]}`;
}

function tokenize(input: string): string[] {
  const normalized = input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];
  return normalized
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 1 || /^\d+$/.test(t))
    .filter((t) => !ADDRESS_STOPWORDS.has(t));
}

function canonicalizeWords(input: string): string {
  let out = input.toLowerCase().replace(/&/g, " and ");
  for (const [re, replacement] of WORD_NORMALIZATIONS) {
    out = out.replace(re, replacement);
  }
  return out;
}

function extractLeadingHouseNumber(raw: string): string | null {
  const firstSegment = raw.split(",")[0]?.trim() ?? raw.trim();
  const match = firstSegment.match(/^\s*(\d+[a-zA-Z]?)/);
  return match?.[1]?.toLowerCase() ?? null;
}

export function normalizeAddress(input: unknown): NormalizedAddress {
  const rawValue = input == null ? "" : String(input);
  const raw = clean(rawValue);
  const postcode = raw ? extractUkPostcode(raw) : null;
  const withoutPostcode = postcode
    ? raw.replace(new RegExp(postcode.replace(" ", "\\s*"), "i"), " ")
    : raw;
  const normalizedNoPostcode = clean(
    canonicalizeWords(withoutPostcode)
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
  );
  const comparable = clean(
    normalizedNoPostcode
      .split(" ")
      .filter((w) => !ADDRESS_STOPWORDS.has(w))
      .join(" ")
  );
  const normalized = clean(
    `${normalizedNoPostcode}${postcode ? ` ${postcode.toLowerCase().replace(/\s+/g, "")}` : ""}`
  );
  const numberToken = extractLeadingHouseNumber(raw);
  const tokens = tokenize(normalizedNoPostcode);
  return {
    raw: raw || null,
    normalized,
    normalizedNoPostcode,
    comparable,
    postcode,
    numberToken,
    tokens,
  };
}

