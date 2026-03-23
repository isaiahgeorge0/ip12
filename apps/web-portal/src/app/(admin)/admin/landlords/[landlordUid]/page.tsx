"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { HistoryBackLink } from "@/components/HistoryBackLink";

type LandlordProfile = {
  uid: string;
  email: string;
  displayName: string;
  status: string;
  agencyIds: string[];
  primaryAgencyId: string | null;
  agencyId: string | null;
};

type InventoryItem = {
  agencyId: string;
  propertyId: string;
  displayAddress: string;
  postcode: string;
  type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  status: string;
  propertyMissing?: boolean;
};

type Grant = {
  landlordUid: string;
  sharedWithAgencyIds: string[];
  updatedAt: unknown;
  updatedByUid: string | null;
};

type AgencyOption = { id: string; name: string };

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    pending: "bg-amber-100 text-amber-800",
    disabled: "bg-zinc-100 text-zinc-600",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-zinc-100 text-zinc-700"}`}
    >
      {status}
    </span>
  );
}

export default function AdminLandlordDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const landlordUid = params?.landlordUid as string | undefined;
  const { profile } = useAuth();
  const queryAgencyId = searchParams?.get("agencyId")?.trim() ?? "";
  const effectiveAgencyId = queryAgencyId || profile?.agencyId || "";
  const [landlord, setLandlord] = useState<LandlordProfile | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [grant, setGrant] = useState<Grant | null>(null);
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grantSaving, setGrantSaving] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [selectedAgencyIds, setSelectedAgencyIds] = useState<string[]>([]);
  const [grantEditMode, setGrantEditMode] = useState(false);
  const [membershipEditMode, setMembershipEditMode] = useState(false);
  const [membershipAgencyIds, setMembershipAgencyIds] = useState<string[]>([]);
  const [membershipPrimaryId, setMembershipPrimaryId] = useState<string>("");
  const [membershipSaving, setMembershipSaving] = useState(false);
  const [membershipError, setMembershipError] = useState<string | null>(null);

  const isSuperAdmin = profile?.role === "superAdmin";

  const load = useCallback(() => {
    if (!landlordUid) {
      setLoading(false);
      setError("Missing landlord");
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/admin/landlords/${encodeURIComponent(landlordUid)}`, { credentials: "include" }),
      fetch(
        `/api/admin/landlords/${encodeURIComponent(landlordUid)}/inventory${
          effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : ""
        }`,
        { credentials: "include" }
      ),
      fetch(`/api/admin/landlord-grants?landlordUid=${encodeURIComponent(landlordUid)}`, {
        credentials: "include",
      }),
    ])
      .then(async ([r1, r2, r3]) => {
        if (!r1.ok) {
          const d = await r1.json().catch(() => ({}));
          setError(d?.error ?? `Failed to load landlord (${r1.status})`);
          setLandlord(null);
          setInventory([]);
          setGrant(null);
          return;
        }
        const [landlordData, inventoryData, grantData] = await Promise.all([
          r1.json(),
          r2.ok ? r2.json() : [],
          r3.ok ? r3.json() : null,
        ]);
        setLandlord(landlordData);
        setInventory(Array.isArray(inventoryData) ? inventoryData : []);
        setGrant(grantData);
        setSelectedAgencyIds(
          Array.isArray(grantData?.sharedWithAgencyIds) ? grantData.sharedWithAgencyIds : []
        );
        const aids = Array.isArray(landlordData?.agencyIds) ? landlordData.agencyIds : [];
        setMembershipAgencyIds(aids);
        const prim =
          landlordData?.primaryAgencyId != null && typeof landlordData.primaryAgencyId === "string"
            ? landlordData.primaryAgencyId
            : aids[0] ?? "";
        setMembershipPrimaryId(prim);
      })
      .catch(() => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[AdminLandlordDetail] failed loading landlord/inventory");
        }
        setError("Failed to load");
        setLandlord(null);
        setInventory([]);
        setGrant(null);
      })
      .finally(() => setLoading(false));
  }, [landlordUid, effectiveAgencyId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch("/api/admin/agencies", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: AgencyOption[]) => setAgencies(Array.isArray(data) ? data : []))
      .catch(() => setAgencies([]));
  }, [isSuperAdmin]);

  const handleSaveMembership = useCallback(() => {
    if (!landlordUid || !isSuperAdmin) return;
    const ids = membershipAgencyIds.filter((x) => x.trim());
    if (ids.length === 0) {
      setMembershipError("At least one agency is required.");
      return;
    }
    const primary = membershipPrimaryId.trim() && ids.includes(membershipPrimaryId) ? membershipPrimaryId : ids[0];
    setMembershipSaving(true);
    setMembershipError(null);
    fetch(`/api/admin/landlords/${encodeURIComponent(landlordUid)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ agencyIds: ids, primaryAgencyId: primary || null }),
    })
      .then(async (res) => {
        if (res.ok) {
          setLandlord((prev) =>
            prev
              ? { ...prev, agencyIds: ids, primaryAgencyId: primary || null, agencyId: primary || null }
              : null
          );
          setMembershipEditMode(false);
          load();
          return;
        }
        const d = await res.json().catch(() => ({}));
        setMembershipError(d?.error ?? "Save failed");
      })
      .catch(() => setMembershipError("Save failed"))
      .finally(() => setMembershipSaving(false));
  }, [landlordUid, isSuperAdmin, membershipAgencyIds, membershipPrimaryId, load]);

  const handleSaveGrant = useCallback(() => {
    if (!landlordUid || !isSuperAdmin) return;
    setGrantSaving(true);
    setGrantError(null);
    fetch("/api/admin/landlord-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ landlordUid, sharedWithAgencyIds: selectedAgencyIds }),
    })
      .then(async (res) => {
        if (res.ok) {
          setGrant({
            landlordUid,
            sharedWithAgencyIds: selectedAgencyIds,
            updatedAt: null,
            updatedByUid: null,
          });
          setGrantEditMode(false);
          load();
          return;
        }
        const d = await res.json().catch(() => ({}));
        setGrantError(d?.error ?? "Save failed");
      })
      .catch(() => setGrantError("Save failed"))
      .finally(() => setGrantSaving(false));
  }, [landlordUid, isSuperAdmin, selectedAgencyIds, load]);

  if (!landlordUid) {
    return (
      <>
        <PageHeader title="Landlord" />
        <p className="text-sm text-zinc-500">Missing landlord.</p>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Landlord" />
        <p className="text-sm text-zinc-500">Loading…</p>
      </>
    );
  }

  if (error || !landlord) {
    return (
      <>
        <PageHeader title="Landlord" />
        <Card className="p-6 mt-4">
          <p className="text-sm text-red-600">{error ?? "Landlord not found."}</p>
          <HistoryBackLink
            href="/admin/landlords"
            className="mt-2 inline-block text-sm font-medium text-zinc-600 hover:underline"
          >
            ← Back to Landlords
          </HistoryBackLink>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Landlord" />
      <Card className="p-6 mt-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-lg font-medium text-zinc-900">
              {landlord.displayName || landlord.email || landlord.uid}
            </h1>
            <p className="text-sm text-zinc-500">{landlord.email || "—"}</p>
          </div>
          <StatusChip status={landlord.status} />
          {(landlord.primaryAgencyId ?? landlord.agencyId) && (
            <span className="text-sm text-zinc-600">
              Primary agency: {landlord.primaryAgencyId ?? landlord.agencyId}
            </span>
          )}
        </div>
        <HistoryBackLink
          href="/admin/landlords"
          className="mt-2 inline-block text-sm font-medium text-zinc-600 hover:underline"
        >
          ← Back to Landlords
        </HistoryBackLink>
      </Card>

      <Card className="p-6 mt-4">
        <h2 className="text-lg font-medium text-zinc-900 mb-3">Agency membership</h2>
        <p className="text-sm text-zinc-500 mb-2">
          Agencies this landlord belongs to. Primary is used as default for display/session.
        </p>
        {membershipEditMode && isSuperAdmin ? (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700">Agencies (at least one)</label>
            <select
              multiple
              value={membershipAgencyIds}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                setMembershipAgencyIds(selected);
                if (selected.length > 0 && !selected.includes(membershipPrimaryId)) {
                  setMembershipPrimaryId(selected[0]);
                }
              }}
              className="block w-full max-w-md rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              size={Math.min(8, Math.max(3, agencies.length))}
            >
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.id})
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500">Hold Ctrl/Cmd to select multiple. At least one required.</p>
            <label className="block text-sm font-medium text-zinc-700 mt-2">Primary agency</label>
            <select
              value={membershipPrimaryId}
              onChange={(e) => setMembershipPrimaryId(e.target.value)}
              className="block w-full max-w-md rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            >
              {membershipAgencyIds.map((id) => (
                <option key={id} value={id}>
                  {agencies.find((a) => a.id === id)?.name ?? id}
                </option>
              ))}
            </select>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={handleSaveMembership}
                disabled={membershipSaving || membershipAgencyIds.length === 0}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {membershipSaving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMembershipEditMode(false);
                  setMembershipAgencyIds(landlord?.agencyIds ?? []);
                  setMembershipPrimaryId(
                    landlord?.primaryAgencyId ?? landlord?.agencyIds?.[0] ?? ""
                  );
                  setMembershipError(null);
                }}
                className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
            {membershipError && (
              <p className="text-sm text-red-600" role="alert">
                {membershipError}
              </p>
            )}
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {Array.isArray(landlord.agencyIds) && landlord.agencyIds.length > 0 ? (
                landlord.agencyIds.map((id) => (
                  <span
                    key={id}
                    className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                      (landlord.primaryAgencyId ?? landlord.agencyId) === id
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-800"
                    }`}
                  >
                    {id}
                    {(landlord.primaryAgencyId ?? landlord.agencyId) === id && " (primary)"}
                  </span>
                ))
              ) : (
                <p className="text-sm text-zinc-500">No agencies set.</p>
              )}
            </div>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setMembershipEditMode(true)}
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Edit
              </button>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6 mt-4">
        <h2 className="text-lg font-medium text-zinc-900 mb-3">Cross-agency visibility</h2>
        <p className="text-sm text-zinc-500 mb-2">
          Agencies that can view this landlord&apos;s full inventory across all of their agencies.
        </p>
        {grantEditMode && isSuperAdmin ? (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700">Shared with agencies</label>
            <select
              multiple
              value={selectedAgencyIds}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                setSelectedAgencyIds(selected);
              }}
              className="block w-full max-w-md rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              size={Math.min(8, Math.max(3, agencies.length))}
            >
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.id})
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500">Hold Ctrl/Cmd to select multiple.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveGrant}
                disabled={grantSaving}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {grantSaving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setGrantEditMode(false);
                  setSelectedAgencyIds(
                    Array.isArray(grant?.sharedWithAgencyIds) ? grant.sharedWithAgencyIds : []
                  );
                  setGrantError(null);
                }}
                className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
            {grantError && (
              <p className="text-sm text-red-600" role="alert">
                {grantError}
              </p>
            )}
          </div>
        ) : (
          <div>
            {Array.isArray(grant?.sharedWithAgencyIds) && grant.sharedWithAgencyIds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {grant.sharedWithAgencyIds.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800"
                  >
                    {id}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">None. Only the landlord&apos;s agencies see their data by default.</p>
            )}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setGrantEditMode(true)}
                className="mt-2 rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Edit
              </button>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6 mt-4">
        <h2 className="text-lg font-medium text-zinc-900 mb-3">Properties (inventory)</h2>
        {inventory.length === 0 ? (
          <EmptyState
            title="No properties"
            description="This landlord has no property assignments in your scope."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead>
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Address
                  </th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Postcode
                  </th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Beds / Baths
                  </th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Agency
                  </th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Link
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {inventory.map((row) => (
                  <tr key={`${row.agencyId}-${row.propertyId}`} className="bg-white">
                    <td className="py-2 px-3 text-sm text-zinc-900">
                      {row.propertyMissing ? `Property ${row.propertyId} — Property record missing` : row.displayAddress || "—"}
                    </td>
                    <td className="py-2 px-3 text-sm text-zinc-600">{row.postcode || "—"}</td>
                    <td className="py-2 px-3 text-sm text-zinc-600">{row.type || "—"}</td>
                    <td className="py-2 px-3 text-sm text-zinc-600">
                      {row.bedrooms != null || row.bathrooms != null
                        ? `${row.bedrooms ?? "—"} / ${row.bathrooms ?? "—"}`
                        : "—"}
                    </td>
                    <td className="py-2 px-3 text-sm text-zinc-600">{row.agencyId}</td>
                    <td className="py-2 px-3">
                      <StatusChip status={row.status} />
                    </td>
                    <td className="py-2 px-3">
                      <Link
                        href={`/admin/properties/${row.propertyId}?agencyId=${encodeURIComponent(row.agencyId)}&landlordUid=${encodeURIComponent(landlordUid)}`}
                        className="text-sm font-medium text-zinc-600 hover:underline"
                      >
                        View property
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
