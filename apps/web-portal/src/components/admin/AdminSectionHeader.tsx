"use client";

import { type ReactNode } from "react";

type AdminSectionHeaderProps = {
  title: string;
  action?: ReactNode;
};

export function AdminSectionHeader({ title, action }: AdminSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-5 pb-2 border-b border-admin-border/60">
      <h2 className="text-lg font-semibold tracking-tight text-admin-fg">{title}</h2>
      {action && <div>{action}</div>}
    </div>
  );
}
