import { forwardRef } from "react";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const base =
  "block w-full rounded-md border bg-admin-surface-muted px-3 py-2 text-admin-fg placeholder:text-admin-muted-fg " +
  "focus-visible:outline-none focus-visible:border-admin-accent focus-visible:ring-2 focus-visible:ring-admin-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-admin-surface " +
  "disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, hasError = false, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      {...props}
      className={cx(
        base,
        hasError ? "border-admin-danger-border focus-visible:ring-admin-danger/30" : "border-admin-border",
        className
      )}
    />
  );
});

