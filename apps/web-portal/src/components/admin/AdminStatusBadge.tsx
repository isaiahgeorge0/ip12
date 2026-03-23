"use client";

import { type StatusBadgeVariant } from "@/lib/admin/statusBadge";

const variantClasses: Record<StatusBadgeVariant, string> = {
  neutral: "bg-admin-neutral text-admin-neutral-fg border-admin-neutral-border",
  action: "bg-admin-warning text-admin-warning-fg border-admin-warning-border",
  inProgress: "bg-admin-inprogress text-admin-inprogress-fg border-admin-inprogress-border",
  info: "bg-admin-info text-admin-info-fg border-admin-info-border",
  success: "bg-admin-success text-admin-success-fg border-admin-success-border",
  danger: "bg-admin-danger text-admin-danger-fg border-admin-danger-border",
};

type AdminStatusBadgeProps = {
  variant: StatusBadgeVariant;
  children: React.ReactNode;
  className?: string;
};

export function AdminStatusBadge({ variant, children, className = "" }: AdminStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
