"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";

const portalNav = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/messages", label: "Messages" },
  { href: "/portal/enquiries", label: "Enquiries" },
  { href: "/portal/viewings", label: "Viewings" },
  { href: "/portal/applications", label: "Applications" },
  { href: "/portal/offers", label: "Offers" },
];

export function PortalLayoutClient({
  children,
}: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile, loading, signOut } = useAuth();

  const handleSignOut = useCallback(async () => {
    await signOut();
    window.location.assign("/sign-in");
  }, [signOut]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (profile && profile.status === "disabled") {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-100 p-6">
        <PageHeader title="Applicant portal" />
        <Card className="p-6 max-w-md">
          <p className="text-zinc-800 mb-4">Account disabled.</p>
          <p className="text-sm text-zinc-500 mb-4">Contact support.</p>
          <button
            type="button"
            onClick={() => signOut().then(() => (window.location.href = "/sign-in"))}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Sign out
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-100">
      <header className="h-14 border-b border-zinc-200 bg-white flex items-center justify-between px-6">
        <nav className="flex items-center gap-4">
          <span className="text-sm font-medium text-zinc-900">Applicant portal</span>
          {portalNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm ${pathname === item.href ? "font-medium text-zinc-900" : "text-zinc-600 hover:text-zinc-900"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-md px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
        >
          Sign out
        </button>
      </header>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
