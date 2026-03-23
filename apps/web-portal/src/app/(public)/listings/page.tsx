import { redirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ListingsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const nextParams = new URLSearchParams();
  for (const [key, raw] of Object.entries(sp)) {
    if (Array.isArray(raw)) {
      for (const v of raw) {
        if (typeof v === "string" && v.trim()) nextParams.append(key, v.trim());
      }
      continue;
    }
    if (typeof raw === "string" && raw.trim()) nextParams.set(key, raw.trim());
  }
  const qs = nextParams.toString();
  redirect(`/properties${qs ? `?${qs}` : ""}`);
}
