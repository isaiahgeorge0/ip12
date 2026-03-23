"use client";

/**
 * Score badge for matching: 80+ strong, 60–79 potential, <60 weak.
 * Uses existing admin token style (emerald, sky, zinc).
 */

import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import type { StatusBadgeVariant } from "@/lib/admin/statusBadge";

type AdminMatchScoreBadgeProps = {
  score: number;
  className?: string;
};

function getVariant(score: number): StatusBadgeVariant {
  if (score >= 80) return "success";
  if (score >= 60) return "inProgress";
  return "neutral";
}

function getLabel(score: number): string {
  if (score >= 80) return "Strong match";
  if (score >= 60) return "Potential match";
  return "Weak match";
}

export function AdminMatchScoreBadge({ score, className = "" }: AdminMatchScoreBadgeProps) {
  const variant = getVariant(score);
  return (
    <AdminStatusBadge variant={variant} className={className}>
      {score}% · {getLabel(score)}
    </AdminStatusBadge>
  );
}
