import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function PublicHome() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <SiteHeader />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <h1 className="text-3xl font-semibold text-zinc-900 mb-2">
          IP12 Estate Portal
        </h1>
        <p className="text-zinc-600 mb-8 max-w-md text-center">
          Property listings, tenant and landlord portals, and agency CRM — all in one place.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/listings"
            className="rounded-lg bg-zinc-900 text-white px-5 py-2.5 font-medium hover:bg-zinc-800"
          >
            Browse listings
          </Link>
          <Link
            href="/sign-in"
            className="rounded-lg border border-zinc-300 px-5 py-2.5 font-medium hover:bg-zinc-100"
          >
            Sign in
          </Link>
          <Link
            href="/admin"
            className="rounded-lg border border-zinc-300 px-5 py-2.5 font-medium hover:bg-zinc-100"
          >
            Admin
          </Link>
          <Link
            href="/landlord"
            className="rounded-lg border border-zinc-300 px-5 py-2.5 font-medium hover:bg-zinc-100"
          >
            Landlord
          </Link>
        </div>
      </main>
    </div>
  );
}
