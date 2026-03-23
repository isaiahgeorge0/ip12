export type AdminDateInput =
  | number
  | string
  | null
  | undefined
  | { seconds?: number; toDate?: () => Date }
  | Date;

type FormatMode = "date" | "dateTime" | "prettyDate" | "prettyDateTime";

function resolveDate(input: AdminDateInput): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return Number.isFinite(input.getTime()) ? input : null;
  if (typeof input === "string") {
    const s = input.trim();
    if (!s) return null;
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    const d = new Date(input);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const t = input as { seconds?: number; toDate?: () => Date };
  if (typeof t?.toDate === "function") {
    const d = t.toDate();
    return d instanceof Date && Number.isFinite(d.getTime()) ? d : null;
  }
  if (typeof t?.seconds === "number" && Number.isFinite(t.seconds)) {
    const d = new Date(t.seconds * 1000);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

export function formatAdminDate(
  input: AdminDateInput,
  mode: FormatMode = "dateTime",
  fallback: string = "—"
): string {
  const d = resolveDate(input);
  if (!d) return fallback;

  if (mode === "date") return d.toLocaleDateString(undefined, { dateStyle: "short" });
  if (mode === "prettyDate") return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  if (mode === "prettyDateTime") {
    return d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

