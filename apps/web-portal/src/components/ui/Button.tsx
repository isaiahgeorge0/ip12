import { forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors select-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-admin-surface " +
  "disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none";

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-admin-accent text-admin-accent-fg hover:bg-admin-accent-hover active:bg-admin-accent-hover/95 shadow-sm shadow-admin-accent/15",
  secondary:
    "bg-admin-surface text-admin-fg border border-admin-border hover:bg-admin-surface-muted active:bg-admin-surface-muted/85",
  ghost: "bg-transparent text-admin-fg hover:bg-admin-surface-muted active:bg-admin-surface-muted/85",
  danger:
    "bg-admin-danger text-admin-danger-fg border border-admin-danger-border hover:bg-admin-danger/90 active:bg-admin-danger/85",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", isLoading = false, disabled, children, ...props },
  ref
) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-disabled={isDisabled ? true : undefined}
      aria-busy={isLoading ? true : undefined}
      {...props}
      className={cx(base, sizeClasses[size], variantClasses[variant], className)}
    >
      {isLoading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : null}
      <span className={cx(isLoading && "opacity-80")}>{children}</span>
    </button>
  );
});

