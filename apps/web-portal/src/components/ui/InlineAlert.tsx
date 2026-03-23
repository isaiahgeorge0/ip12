import { type ReactNode } from "react";

type Variant = "info" | "success" | "warning" | "danger";

const variantClasses: Record<Variant, string> = {
  info: "border-admin-info-border bg-admin-info/50 text-admin-info-fg",
  success: "border-admin-success-border bg-admin-success/50 text-admin-success-fg",
  warning: "border-admin-warning-border bg-admin-warning/50 text-admin-warning-fg",
  danger: "border-admin-danger-border bg-admin-danger/50 text-admin-danger-fg",
};

type InlineAlertProps = {
  variant?: Variant;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function InlineAlert({
  variant = "info",
  title,
  description,
  action,
  className = "",
}: InlineAlertProps) {
  return (
    <div
      className={[
        "rounded-lg border px-4 py-3",
        variantClasses[variant],
        className,
      ].join(" ")}
      role={variant === "danger" ? "alert" : "status"}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {description ? <p className="mt-0.5 text-sm opacity-90">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

