"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * History-aware back link: tries browser back when the user came from in-app;
 * otherwise navigates to the fallback href. Never sends users outside the app.
 */
function hasInAppHistory(): boolean {
  if (typeof window === "undefined") return false;
  if (window.history.length <= 1) return false;
  const referrer = document.referrer || "";
  if (!referrer) return false;
  return referrer.startsWith(window.location.origin);
}

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

function withAgencyId(href: string, agencyId: string | null): string {
  if (!agencyId) return href;
  if (!href.startsWith("/admin")) return href;
  if (href.includes("agencyId=")) return href;

  const [pathAndQuery, hash = ""] = href.split("#");
  const [path, qs = ""] = pathAndQuery.split("?");
  const params = new URLSearchParams(qs);
  params.set("agencyId", agencyId);
  const q = params.toString();
  const rebuilt = q ? `${path}?${q}` : path;
  return hash ? `${rebuilt}#${hash}` : rebuilt;
}

export function HistoryBackLink({ href, children, className }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agencyId = searchParams?.get("agencyId")?.trim() || null;
  const effectiveHref = withAgencyId(href, agencyId);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (hasInAppHistory()) {
      e.preventDefault();
      router.back();
    }
  };

  return (
    <Link href={effectiveHref} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}
