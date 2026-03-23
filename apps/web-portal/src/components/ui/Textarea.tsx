import { forwardRef } from "react";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  hasError?: boolean;
  /** Default true; set false to disable resize handle */
  resizable?: boolean;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const base =
  "block w-full rounded-md border bg-admin-surface-muted px-3 py-2 text-admin-fg placeholder:text-admin-muted-fg " +
  "focus-visible:outline-none focus-visible:border-admin-accent focus-visible:ring-2 focus-visible:ring-admin-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-admin-surface " +
  "disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, hasError = false, resizable = true, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      {...props}
      className={cx(
        base,
        resizable ? "resize-y" : "resize-none",
        hasError ? "border-admin-danger-border focus-visible:ring-admin-danger/30" : "border-admin-border",
        className
      )}
    />
  );
});

