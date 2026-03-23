"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export function SiteHeader() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <header className="border-b border-public-border bg-public-surface/95 backdrop-blur">
      <div className="max-w-6xl mx-auto px-[var(--pt-spacing-container)] h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight text-public-fg">
          IP12 Estate Portal
        </Link>
        <nav className="flex gap-4">
          <Link href="/properties" className="text-sm text-public-muted-fg transition-colors hover:text-public-fg">
            Listings
          </Link>
          {!loading && (
            user ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="text-sm text-public-muted-fg transition-colors hover:text-public-fg"
              >
                Sign out
              </button>
            ) : (
              <Link href="/sign-in" className="text-sm text-public-muted-fg transition-colors hover:text-public-fg">
                Sign in
              </Link>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
