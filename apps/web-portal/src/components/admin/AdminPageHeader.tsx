"use client";

import { type ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  /** Primary action button/link (right aligned) */
  primaryAction?: ReactNode;
  /** Optional secondary actions shown next to primary */
  secondaryActions?: ReactNode;
};

export function AdminPageHeader({ title, subtitle, primaryAction, secondaryActions }: Props) {
  const action =
    primaryAction || secondaryActions ? (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {secondaryActions}
        {primaryAction}
      </div>
    ) : undefined;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-8">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-admin-fg">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-sm text-admin-muted-fg">{subtitle}</p> : null}
      </div>
      {action ? <div className="mt-2 sm:mt-0">{action}</div> : null}
    </div>
  );
}

