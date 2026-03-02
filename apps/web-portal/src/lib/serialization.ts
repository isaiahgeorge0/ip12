/**
 * Serialize Firestore Timestamp (or similar) to a JSON-serializable value
 * for passing from Server Components to Client Components.
 * Returns ms since epoch (number) or null.
 */
export function serializeTimestamp(v: unknown): number | null {
  if (v == null) return null;
  const t = v as { seconds?: number; nanoseconds?: number; toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().getTime();
  if (typeof t.seconds === "number")
    return t.seconds * 1000 + ((t.nanoseconds ?? 0) / 1e6);
  return null;
}
