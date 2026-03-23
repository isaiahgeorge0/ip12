import Link from "next/link";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { InlineAlert } from "@/components/ui/InlineAlert";

export type AdminTableColumn<T> = {
  key: string;
  label: string;
  /** Optional cell renderer (falls back to row[key]) */
  render?: (row: T) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
};

export type AdminTableEmptyState = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export const adminTableActionClassName =
  "inline-flex items-center justify-center rounded-md border border-admin-border bg-admin-surface px-2 py-1 text-xs font-medium text-admin-fg " +
  "hover:bg-admin-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-admin-surface";

export function AdminTableActionLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`${adminTableActionClassName} ${className}`.trim()}>
      {children}
    </Link>
  );
}

export function AdminTableActionButton({
  onClick,
  children,
  className = "",
  type = "button",
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`${adminTableActionClassName} ${className}`.trim()}
    >
      {children}
    </button>
  );
}

export function AdminTable<T>({
  title,
  description,
  columns,
  rows,
  getRowKey,
  renderActions,
  emptyState,
  isLoading,
  loadingText = "Loading…",
  error,
  skeletonRowCount = 6,
}: {
  title?: string;
  description?: string;
  columns: Array<AdminTableColumn<T>>;
  rows: T[];
  getRowKey: (row: T) => string;
  renderActions?: (row: T) => React.ReactNode;
  emptyState?: AdminTableEmptyState;
  isLoading?: boolean;
  loadingText?: string;
  error?: { title: string; description?: string } | null;
  skeletonRowCount?: number;
}) {
  const showActions = typeof renderActions === "function";

  return (
    <Card className="overflow-hidden">
      {title || description ? (
        <div className="px-5 py-4">
          {title ? <h2 className="text-sm font-semibold text-admin-fg">{title}</h2> : null}
          {description ? (
            <p className="text-xs text-admin-muted-fg mt-0.5">{description}</p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="p-4">
          <InlineAlert variant="danger" title={error.title} description={error.description} />
        </div>
      ) : null}

      {isLoading ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm divide-y divide-admin-border">
            <thead>
              <tr className="bg-admin-surface-muted/85">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`px-5 py-3 text-left text-xs font-semibold text-admin-neutral-fg uppercase tracking-wide ${c.headerClassName ?? ""}`}
                  >
                    {c.label}
                  </th>
                ))}
                {showActions ? (
                  <th className="px-5 py-3 text-right text-xs font-semibold text-admin-neutral-fg uppercase tracking-wide">
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {Array.from({ length: skeletonRowCount }).map((_, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key} className={`px-5 py-3 ${c.cellClassName ?? ""}`}>
                      <Skeleton className="h-4 w-full max-w-[240px]" />
                    </td>
                  ))}
                  {showActions ? (
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Skeleton className="h-6 w-20" />
                        <Skeleton className="h-6 w-24" />
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 text-sm text-admin-muted-fg">{loadingText}</div>
        </div>
      ) : rows.length === 0 ? (
        emptyState ? (
          <EmptyState
            title={emptyState.title}
            description={emptyState.description}
            action={emptyState.action}
          />
        ) : (
          <EmptyState title="Nothing here yet" />
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm divide-y divide-admin-border">
            <thead>
              <tr className="bg-admin-surface-muted/85">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`px-5 py-3 text-left text-xs font-semibold text-admin-neutral-fg uppercase tracking-wide ${c.headerClassName ?? ""}`}
                  >
                    {c.label}
                  </th>
                ))}
                {showActions ? (
                  <th className="px-5 py-3 text-right text-xs font-semibold text-admin-neutral-fg uppercase tracking-wide">
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {rows.map((row) => (
                <tr key={getRowKey(row)} className="text-admin-fg hover:bg-admin-accent-soft">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-5 py-3 align-top ${c.cellClassName ?? ""}`}>
                      {c.render ? (c.render(row) as React.ReactNode) : (row as any)?.[c.key]}
                    </td>
                  ))}
                  {showActions ? (
                    <td className="px-5 py-3 text-right align-top">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {renderActions?.(row)}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

