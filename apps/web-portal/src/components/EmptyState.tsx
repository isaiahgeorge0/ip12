import { type ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-admin-border bg-admin-surface-muted/50 p-8 text-center">
      <p className="font-medium text-admin-fg">{title}</p>
      {description && <p className="mt-1 text-sm text-admin-muted-fg">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
