import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { mockProperties } from "@/lib/public/mockProperties";
import { PropertyCard } from "@/components/public/PropertyCard";
import { HomeSearchForm } from "@/components/public/HomeSearchForm";
import { HomePersonalizationSections } from "@/components/public/HomePersonalizationSections";
import { PublicThemeProvider } from "@/lib/public/theme/PublicThemeProvider";

export const metadata: Metadata = {
  title: "Estate Agency Platform | Find a Home",
  description:
    "Browse available rental properties, filter by price and features, and explore listing details.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Estate Agency Platform | Find a Home",
    description:
      "Browse available rental properties, filter by price and features, and explore listing details.",
    type: "website",
    url: "/",
  },
};

export default function PublicHome() {
  const featured = mockProperties.slice(0, 6);

  return (
    <PublicThemeProvider mode="light">
      <div className="public-page-shell min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1">
          <section className="relative overflow-hidden max-w-6xl mx-auto px-[var(--pt-spacing-container)] py-14 lg:py-20">
            <div className="public-hero-glow absolute inset-0 rounded-[calc(var(--pt-radius-card)+2px)] pointer-events-none" />
            <div className="relative max-w-3xl">
              <h1 className="text-[var(--pt-font-hero-title)] leading-tight font-semibold tracking-tight text-public-fg">
                Find a home with confidence
              </h1>
              <p className="mt-3 text-base font-medium text-public-accent">
                Trusted local expertise with a modern rental journey.
              </p>
              <p className="mt-4 text-[var(--pt-font-body)] text-public-muted-fg max-w-xl">
                Property search, enquiry flow, and a modern experience for tenants, landlords, and staff.
              </p>

              <div className="public-card mt-8 rounded-[var(--pt-radius-card)] border border-public-border bg-public-surface p-5 sm:p-6 shadow-[0_14px_34px_rgb(24_24_27_/_0.09)]">
                <HomeSearchForm />
              </div>
            </div>
          </section>

          <section className="max-w-6xl mx-auto px-[var(--pt-spacing-container)] pb-10">
            <div className="mb-5 h-px w-full bg-gradient-to-r from-transparent via-public-border to-transparent" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="public-card rounded-[var(--pt-radius-card)] border border-public-border bg-public-surface p-4">
                <p className="text-2xl font-semibold tracking-tight text-public-fg">450+</p>
                <p className="mt-1 text-xs text-public-muted-fg">Properties managed</p>
              </div>
              <div className="public-card rounded-[var(--pt-radius-card)] border border-public-border bg-public-surface p-4">
                <p className="text-2xl font-semibold tracking-tight text-public-fg">18 yrs</p>
                <p className="mt-1 text-xs text-public-muted-fg">Local market experience</p>
              </div>
              <div className="public-card rounded-[var(--pt-radius-card)] border border-public-border bg-public-surface p-4">
                <p className="text-2xl font-semibold tracking-tight text-public-fg">4.8/5</p>
                <p className="mt-1 text-xs text-public-muted-fg">Average tenant rating</p>
              </div>
              <div className="public-card rounded-[var(--pt-radius-card)] border border-public-border bg-public-surface p-4">
                <p className="text-2xl font-semibold tracking-tight text-public-fg">24h</p>
                <p className="mt-1 text-xs text-public-muted-fg">Typical enquiry response</p>
              </div>
            </div>
          </section>

          <HomePersonalizationSections />

          <section className="max-w-6xl mx-auto px-[var(--pt-spacing-container)] pb-14">
            <div className="flex items-end justify-between gap-4 mb-7">
              <div>
                <h2 className="text-[var(--pt-font-section-title)] font-semibold text-public-fg">
                  Featured properties
                </h2>
                <p className="mt-1 text-[var(--pt-font-meta)] text-public-muted-fg">
                  A curated set of example listings.
                </p>
              </div>
              <Link href="/properties" className="text-sm font-medium text-public-accent hover:underline">
                Browse all properties →
              </Link>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          </section>

          <section className="max-w-6xl mx-auto px-[var(--pt-spacing-container)] pb-16">
            <div className="public-card rounded-[var(--pt-radius-card)] border border-public-border bg-public-surface p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div>
                <h2 className="text-[var(--pt-font-section-title)] font-semibold text-public-fg">
                  Ready to explore?
                </h2>
                <p className="mt-1 text-sm text-public-muted-fg">
                  Use filters to narrow results and view details when you are ready.
                </p>
              </div>
              <Link
                href="/properties"
                className="inline-flex items-center justify-center rounded-[var(--pt-radius-button)] bg-public-accent px-5 py-2.5 text-sm font-medium text-public-accent-fg transition-colors hover:bg-public-accent-hover active:scale-[0.99]"
              >
                Browse all properties
              </Link>
            </div>
          </section>
        </main>
      </div>
    </PublicThemeProvider>
  );
}
