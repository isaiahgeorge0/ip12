"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

type AgencyOption = { id: string; name: string };

export function AdminAgencySwitcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);

  const currentAgencyId = searchParams?.get("agencyId")?.trim() ?? "";

  useEffect(() => {
    fetch("/api/admin/agencies", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: AgencyOption[]) => setAgencies(Array.isArray(data) ? data : []))
      .catch(() => setAgencies([]));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (v) params.set("agencyId", v);
    else params.delete("agencyId");
    const q = params.toString() ? `?${params.toString()}` : "";
    router.replace(`${pathname ?? "/admin"}${q}`);
  };

  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-medium text-zinc-500 whitespace-nowrap">Agency</span>
      <select
        value={currentAgencyId}
        onChange={handleChange}
        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 bg-white min-w-[160px]"
        title="Switch agency context"
      >
        <option value="">— Choose agency —</option>
        {agencies.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name || a.id}
          </option>
        ))}
      </select>
    </label>
  );
}
