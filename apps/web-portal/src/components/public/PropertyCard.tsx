import Link from "next/link";
import { Card } from "@/components/Card";
import type { PublicProperty } from "@/lib/public/mockProperties";

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

type Props = {
  property: PublicProperty;
  returnTo?: string;
};

export function PropertyCard({ property, returnTo }: Props) {
  const href = new URLSearchParams();
  if (returnTo) href.set("returnTo", returnTo);
  const query = href.toString();
  const propertyHref = `/properties/${encodeURIComponent(property.id)}${query ? `?${query}` : ""}`;

  return (
    <Link
      href={propertyHref}
      className="block h-full"
    >
      <Card className="public-card public-card-hover group h-full min-w-0 border-public-border bg-public-surface hover:border-public-accent/45 hover:-translate-y-0.5">
        <div className="flex flex-col h-full">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--pt-radius-input)] border border-public-border bg-public-accent-soft/40 flex items-center justify-center">
            <div className="absolute inset-0 opacity-70 transition-opacity group-hover:opacity-100 bg-gradient-to-t from-public-fg/10 via-transparent to-transparent" />
            <div className="relative text-xs text-public-muted-fg">
              <span className="inline-flex items-center gap-2 rounded-full border border-public-border bg-public-surface/60 px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-public-accent-soft" aria-hidden="true" />
                Image preview
              </span>
            </div>
          </div>

          <div className="mt-4 flex-1 flex flex-col">
            <p className="text-sm font-semibold text-public-fg">{property.address}</p>
            <p className="text-xs text-public-muted-fg mt-1">{property.location}</p>

            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <span className="inline-flex items-center rounded-md bg-public-accent-soft px-2 py-0.5 text-xs text-public-muted-fg">
                {property.beds} bed
              </span>
              <span className="inline-flex items-center rounded-md bg-public-accent-soft px-2 py-0.5 text-xs text-public-muted-fg">
                {property.baths} bath
              </span>
              <span className="inline-flex items-center rounded-md bg-public-accent-soft px-2 py-0.5 text-xs text-public-muted-fg">
                {property.propertyType}
              </span>
            </div>

            <p className="mt-4 truncate text-[clamp(1.5rem,2.4vw,2rem)] leading-tight font-semibold tracking-tight text-public-fg">
              {formatGBP(property.price)}/month
            </p>
          </div>

          <div className="mt-5 inline-flex items-center justify-start text-sm font-medium text-public-accent transition-colors group-hover:text-public-accent">
            View details <span className="ml-1 transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

