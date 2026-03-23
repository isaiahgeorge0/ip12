import { Suspense } from "react";
import type { Metadata } from "next";
import PropertiesSearchClient from "./PropertiesSearchClient";
import { PublicThemeProvider } from "@/lib/public/theme/PublicThemeProvider";

export const metadata: Metadata = {
  title: "Browse Properties | Estate Agency Platform",
  description:
    "Search available properties by location, price, bedrooms, and property type.",
  alternates: {
    canonical: "/properties",
  },
  openGraph: {
    title: "Browse Properties | Estate Agency Platform",
    description:
      "Search available properties by location, price, bedrooms, and property type.",
    type: "website",
    url: "/properties",
  },
};

export default function PropertiesSearchPage() {
  return (
    <Suspense
      fallback={
        <PublicThemeProvider mode="light">
          <div className="public-page-shell min-h-screen">
            <main className="max-w-6xl mx-auto px-[var(--pt-spacing-container)] py-8">
              <div className="h-9 w-64 rounded bg-public-accent-soft animate-pulse" />
              <div className="mt-3 h-4 w-80 rounded bg-public-accent-soft/70 animate-pulse" />
              <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
                <div className="public-card rounded-[var(--pt-radius-card)] border border-public-border bg-public-surface p-5">
                  <div className="h-4 w-24 rounded bg-public-accent-soft animate-pulse" />
                  <div className="mt-3 space-y-3">
                    <div className="h-10 rounded bg-public-accent-soft/70 animate-pulse" />
                    <div className="h-10 rounded bg-public-accent-soft/70 animate-pulse" />
                    <div className="h-10 rounded bg-public-accent-soft/70 animate-pulse" />
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={`public-loading-card-${idx}`}
                      className="public-card rounded-[var(--pt-radius-card)] border border-public-border bg-public-surface p-4"
                    >
                      <div className="aspect-[4/3] rounded bg-public-accent-soft animate-pulse" />
                      <div className="mt-4 h-4 w-3/4 rounded bg-public-accent-soft/70 animate-pulse" />
                      <div className="mt-2 h-4 w-1/2 rounded bg-public-accent-soft/70 animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </main>
          </div>
        </PublicThemeProvider>
      }
    >
      <PropertiesSearchClient />
    </Suspense>
  );
}

