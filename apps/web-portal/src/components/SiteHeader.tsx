import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold text-zinc-900">
          IP12 Estate Portal
        </Link>
        <nav className="flex gap-4">
          <Link href="/listings" className="text-sm text-zinc-600 hover:text-zinc-900">
            Listings
          </Link>
          <Link href="/sign-in" className="text-sm text-zinc-600 hover:text-zinc-900">
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
