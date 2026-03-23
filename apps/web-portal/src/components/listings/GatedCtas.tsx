"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { EnquiryModal, type EnquiryListingContext } from "./EnquiryModal";
import type { ApplicantProfile } from "@/lib/types/applicantProfile";

type Props = {
  listingId: string;
  /** When provided and user is signed in, Enquire opens the enquiry form instead of redirecting. */
  listingContext?: EnquiryListingContext;
};

/** Paths that are safe to redirect to after sign-in (public browsing). */
function isSafeReturnTo(path: string | null): boolean {
  if (!path || path !== path.trim()) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("/admin") || path.startsWith("/landlord") || path.startsWith("/superadmin")) return false;
  return true;
}

export function GatedCtas({ listingId, listingContext }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [applicantProfile, setApplicantProfile] = useState<ApplicantProfile | null | undefined>(undefined);

  useEffect(() => {
    if (!enquiryOpen || !user) {
      setApplicantProfile(undefined);
      return;
    }
    let cancelled = false;
    fetch("/api/applicant/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { profile: null }))
      .then((data: { profile?: ApplicantProfile | null }) => {
        if (!cancelled) setApplicantProfile(data?.profile ?? null);
      })
      .catch(() => {
        if (!cancelled) setApplicantProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enquiryOpen, user]);

  const promptSignIn = () => {
    const returnTo = pathname && isSafeReturnTo(pathname) ? pathname : "";
    router.push(returnTo ? `/sign-in?returnTo=${encodeURIComponent(returnTo)}` : "/sign-in");
  };

  const handleEnquireClick = () => {
    if (!user) {
      promptSignIn();
      return;
    }
    if (listingContext) {
      setEnquiryOpen(true);
    } else {
      promptSignIn();
    }
  };

  return (
    <>
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <p className="text-sm font-medium text-zinc-900">Interested?</p>
        <p className="text-sm text-zinc-600 mt-1">
          You can browse listings without an account. To enquire, save, or book a
          viewing you’ll need to sign in.
        </p>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            onClick={handleEnquireClick}
          >
            Enquire
          </button>
          <button
            type="button"
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            onClick={promptSignIn}
          >
            Save property
          </button>
          <button
            type="button"
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            onClick={promptSignIn}
          >
            Book viewing
          </button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Listing ID: <span className="font-mono">{listingId}</span>
        </p>
      </div>

      {enquiryOpen && listingContext && user && (
        <EnquiryModal
          listing={listingContext}
          defaultName={profile?.displayName?.trim() || user.email?.split("@")[0] || ""}
          defaultEmail={user.email ?? ""}
          defaultPhone={typeof (profile as { phone?: string })?.phone === "string" ? (profile as { phone?: string }).phone : ""}
          applicantProfile={applicantProfile ?? null}
          onClose={() => setEnquiryOpen(false)}
          onSuccess={() => {}}
        />
      )}
    </>
  );
}
