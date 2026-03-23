import { type ReactNode, useId } from "react";

type Props = {
  label: string;
  children: (args: { id: string; describedById?: string; hasError: boolean }) => ReactNode;
  /** Optional helper text shown under the input when no error */
  helperText?: string;
  /** Optional error message shown under the input */
  error?: string | null;
  /** Optional id override for the input */
  id?: string;
  required?: boolean;
};

export function FormField({ label, children, helperText, error, id, required }: Props) {
  const reactId = useId();
  const inputId = id ?? `field-${reactId}`;
  const hasError = Boolean(error);
  const describedById = helperText || error ? `${inputId}-desc` : undefined;

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-admin-fg">
        {label} {required ? <span className="text-admin-danger-fg/90">*</span> : null}
      </label>
      <div className="mt-1.5">
        {children({ id: inputId, describedById, hasError })}
      </div>
      {hasError ? (
        <p id={describedById} className="mt-1.5 text-sm text-admin-danger-fg">
          {error}
        </p>
      ) : helperText ? (
        <p id={describedById} className="mt-1.5 text-sm text-admin-muted-fg">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

