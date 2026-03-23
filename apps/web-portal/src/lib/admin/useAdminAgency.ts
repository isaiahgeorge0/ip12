"use client";

import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/**
 * IMPORTANT:
 * Admin pages must use effectiveAgencyId (superAdmin = URL param, admin = session).
 * Do not use session-only agencyId in admin pages.
 */
export function useAdminAgency() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();

  const isSuperAdmin = profile?.role === "superAdmin";
  const agencyId = profile?.agencyId ?? null;
  const agencyIdParam = searchParams?.get("agencyId")?.trim() || null;

  const effectiveAgencyId = isSuperAdmin ? agencyIdParam : agencyId;
  const hasAgencySelected = !!effectiveAgencyId;

  return {
    agencyId,
    effectiveAgencyId,
    isSuperAdmin,
    hasAgencySelected,
  };
}

