import { type ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  /** Optional one-line helper text under the title */
  subtitle?: string;
  action?: ReactNode;
};

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-admin-fg">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-admin-muted-fg">{subtitle}</p>}
      </div>
      {action && <div className="mt-2 sm:mt-0">{action}</div>}
    </div>
  );
}
