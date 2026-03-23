import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Card } from "@/components/Card";
import { mockProperties } from "@/lib/public/mockProperties";
import type { PublicProperty } from "@/lib/public/mockProperties";
import { TrackRecentlyViewedProperty } from "@/components/public/TrackRecentlyViewedProperty";
import { PublicThemeProvider } from "@/lib/public/theme/PublicThemeProvider";

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

type PageProps = {
  params: { id: string };
  searchParams?: { returnTo?: string };
};

function getSafeReturnTo(returnTo: string | undefined): string {
  if (!returnTo) return "/properties";
  if (!returnTo.startsWith("/properties")) return "/properties";
  return returnTo;
}

function getPropertyById(id: string): PublicProperty | null {
  return mockProperties.find((p) => p.id === id) ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const property = getPropertyById(params.id);
  if (!property) {
    return {
      title: "Property not found | Estate Agency Platform",
      description: "The property listing you requested could not be found.",
      alternates: { canonical: `/properties/${encodeURIComponent(params.id)}` },
    };
  }

  const title = `${property.address}, ${property.location} | ${formatGBP(property.price)}/month`;
  const description = `${property.beds} bed, ${property.baths} bath ${property.propertyType.toLowerCase()} in ${property.location}.`;

  return {
    title,
    description,
    alternates: { canonical: `/properties/${encodeURIComponent(property.id)}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/properties/${encodeURIComponent(property.id)}`,
    },
  };
}

export default function PropertyListingPage({ params, searchParams }: PageProps) {
  const { id } = params;
  const property = getPropertyById(id);
  if (!property) notFound();

  const p = property as PublicProperty;
  const price = formatGBP(p.price);
  const returnTo = getSafeReturnTo(searchParams?.returnTo);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${p.address}, ${p.location}`,
    description: p.description,
    category: "ResidentialProperty",
    image: p.images.map((img) => `https://example.com/images/${encodeURIComponent(img)}`),
    offers: {
      "@type": "Offer",
      priceCurrency: "GBP",
      price: p.price,
      availability: "https://schema.org/InStock",
      url: `https://example.com/properties/${encodeURIComponent(p.id)}`,
    },
  };

  return (
    <PublicThemeProvider mode="light">
      <div className="public-page-shell min-h-screen flex flex-col">
        <SiteHeader />
        <TrackRecentlyViewedProperty propertyId={p.id} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <main className="flex-1 max-w-6xl w-full mx-auto px-[var(--pt-spacing-container)] py-8">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Link href={returnTo} className="text-sm text-public-muted-fg hover:underline inline-block">
              ← Back to properties
            </Link>
            <span className="inline-flex w-fit items-center rounded-full border border-public-border bg-public-accent-soft px-3 py-1 text-xs font-medium text-public-fg">
              Managed by IP12 Estate Portal
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <Card className="public-card p-0 overflow-hidden border-public-border bg-public-surface">
              <div className="relative aspect-[16/10] bg-public-accent-soft/40 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-t from-public-fg/8 via-transparent to-transparent" />
                <div className="relative text-sm text-public-muted-fg">Image gallery placeholder</div>
              </div>
              <div className="p-6">
                <h1 className="text-[var(--pt-font-hero-title)] leading-tight font-semibold text-public-fg">{p.address}</h1>
                <p className="mt-2 text-public-muted-fg">{p.location}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-md bg-public-accent-soft px-2 py-0.5 text-xs text-public-muted-fg">
                    {p.beds} bed · {p.baths} bath
                  </span>
                  <span className="rounded-md bg-public-accent-soft px-2 py-0.5 text-xs text-public-muted-fg">{p.propertyType}</span>
                </div>

                <p className="mt-5 text-3xl font-semibold tracking-tight text-public-fg">{price}/month</p>

                <div className="mt-8 border-t border-public-border pt-6">
                  <h2 className="text-sm font-semibold text-public-fg">Description</h2>
                  <p className="mt-2 max-w-3xl text-[15px] text-public-muted-fg leading-7">
                    {p.description}
                  </p>
                </div>

                <div className="mt-8 border-t border-public-border pt-6">
                  <h2 className="text-sm font-semibold text-public-fg">Property metadata</h2>
                  <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-public-muted-fg">Reference</dt>
                      <dd className="font-medium text-public-fg">{p.id}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-public-muted-fg">Listing type</dt>
                      <dd className="font-medium text-public-fg">Managed rental</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-public-muted-fg">Managed by</dt>
                      <dd className="font-medium text-public-fg">IP12 Estate Portal</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-public-muted-fg">Status</dt>
                      <dd className="font-medium text-public-fg">Available</dd>
                    </div>
                  </dl>
                </div>
              </div>
              </Card>
            </div>

            <div className="lg:col-span-4">
              <div className="flex flex-col gap-4 lg:sticky lg:top-24 h-fit">
              <Card className="public-card border-public-border bg-public-surface shadow-[0_12px_30px_rgb(24_24_27_/_0.10)]">
                <p className="text-xs font-medium text-public-accent">Trusted listing</p>
                <h2 className="mt-1 text-base font-semibold text-public-fg">Arrange a viewing</h2>
                <p className="mt-1 text-sm text-public-muted-fg">
                  We will connect you with the agency to arrange next steps.
                </p>

                <div className="mt-5 flex flex-col gap-2">
                  <Link
                    href="/sign-in"
                    className="inline-flex items-center justify-center rounded-[var(--pt-radius-button)] bg-public-accent px-4 py-2.5 text-sm font-medium text-public-accent-fg transition-colors hover:bg-public-accent-hover active:scale-[0.99]"
                  >
                    Enquire
                  </Link>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-[var(--pt-radius-button)] border border-public-border px-4 py-2.5 text-sm font-medium text-public-fg transition-colors hover:bg-public-accent-soft active:scale-[0.99] disabled:opacity-50"
                    disabled
                  >
                    Save property (placeholder)
                  </button>
                </div>
              </Card>

              <Card className="public-card border-public-border bg-public-surface">
                <h2 className="text-sm font-semibold text-public-fg">Key features</h2>
                <ul className="mt-3 flex flex-col gap-2 text-sm text-public-muted-fg">
                  <li className="flex items-center justify-between gap-3">
                    <span>Price</span>
                    <span className="font-medium text-public-fg">{price}/month</span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span>Beds / baths</span>
                    <span className="font-medium text-public-fg">
                      {p.beds} bed · {p.baths} bath
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span>Type</span>
                    <span className="font-medium text-public-fg">{p.propertyType}</span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span>Location</span>
                    <span className="font-medium text-public-fg">{p.location}</span>
                  </li>
                </ul>
              </Card>

              <Card className="public-card border-public-border bg-public-surface">
                <h2 className="text-sm font-semibold text-public-fg">Gallery</h2>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {p.images.slice(0, 6).map((img, idx) => (
                    <div
                      key={`${img}-${idx}`}
                      className="aspect-square rounded-[var(--pt-radius-input)] bg-public-accent-soft border border-public-border flex items-center justify-center"
                    >
                      <span className="text-[10px] text-public-muted-fg">Photo</span>
                    </div>
                  ))}
                </div>
              </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </PublicThemeProvider>
  );
}

