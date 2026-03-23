"use client";

import Link from "next/link";
import { Card } from "@/components/Card";

type AdminSummaryCardProps = {
  title: string;
  count: number;
  helperText: string;
  ctaLabel: string;
  ctaHref: string;
  /** Optional: use orange accent for high-priority cards */
  highlight?: boolean;
  /** Optional: when set, display this instead of count (e.g. formatted currency) */
  displayValue?: string;
};

export function AdminSummaryCard({
  title,
  count,
  helperText,
  ctaLabel,
  ctaHref,
  highlight = false,
  displayValue,
}: AdminSummaryCardProps) {
  return (
    <Card
      className={`p-5 h-full flex flex-col transition-colors ${highlight ? "border-admin-warning-border bg-admin-warning/40" : "hover:bg-admin-surface-muted/40 hover:border-admin-border"}`}
    >
      <p className="text-sm font-semibold text-admin-neutral-fg">{title}</p>
      <p className="mt-2 text-[32px] leading-tight font-semibold tracking-tight text-admin-fg">
        {displayValue ?? count}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-admin-muted-fg/90">{helperText}</p>
      <Link
        href={ctaHref}
        className={`mt-auto pt-4 inline-flex items-center text-sm font-medium ${highlight ? "text-admin-warning-fg hover:underline" : "text-admin-neutral-fg hover:underline"}`}
      >
        {ctaLabel}
        <span className="ml-1">→</span>
      </Link>
    </Card>
  );
}
