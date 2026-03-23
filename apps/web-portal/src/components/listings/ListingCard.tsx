import Link from "next/link";
import { Card } from "@/components/Card";
import type { PropertySearchHit } from "./types";
import { bedsBathsLabel, primaryPriceLabel } from "./format";

type Props = {
  hit: PropertySearchHit;
  isSelected?: boolean;
};

export function ListingCard({ hit, isSelected = false }: Props) {
  const title = hit.title || hit.displayAddress || "Property";
  const address = hit.displayAddress || hit.postcode || "";
  const meta = bedsBathsLabel(hit);
  const price = primaryPriceLabel(hit);

  return (
    <Link
      href={`/listings/${encodeURIComponent(hit.docId)}`}
      className={`block ${isSelected ? "ring-2 ring-blue-500 ring-offset-2 rounded-lg" : ""}`}
    >
      <Card className="h-full hover:border-zinc-400 transition-colors">
        <p className="font-medium text-zinc-900 line-clamp-2">{title}</p>
        {address ? <p className="text-sm text-zinc-600 mt-1 line-clamp-2">{address}</p> : null}
        {meta ? <p className="text-sm text-zinc-500 mt-1">{meta}</p> : null}
        {price ? <p className="mt-2 font-medium text-zinc-900">{price}</p> : null}
        {hit.listingType ? (
          <span className="inline-flex mt-2 text-xs text-zinc-600 rounded bg-zinc-100 px-2 py-0.5">
            {hit.listingType}
          </span>
        ) : null}
      </Card>
    </Link>
  );
}

