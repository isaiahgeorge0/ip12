import { type ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  action?: ReactNode;
};

export function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
      <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
      {action && <div>{action}</div>}
    </div>
  );
}
