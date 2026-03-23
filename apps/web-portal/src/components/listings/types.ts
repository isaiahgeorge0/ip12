export type ListingsSearchParams = {
  q?: string;
  listingType?: "sale" | "rent";
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  available?: boolean;
  limit?: number;
  bounds?: string;
};

export type PropertySearchHit = {
  docId: string;
  agencyId: string;
  propertyId: string;
  title?: string;
  displayAddress?: string;
  postcode?: string;
  lat?: number;
  lng?: number;
  price?: number;
  rent?: number;
  beds?: number;
  baths?: number;
  propertyType?: string;
  listingType?: string;
  available?: boolean;
  updatedAt?: unknown;
};

/** Response shape from GET /api/properties/search (cursor pagination). */
export type PropertySearchResponse = {
  results: PropertySearchHit[];
  nextCursor: string | null;
};

