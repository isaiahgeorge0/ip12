"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { propertiesCol } from "@/lib/firestore/paths";
import { AdminCreateTicketModal } from "@/components/admin/AdminCreateTicketModal";

type PropertyType = "House" | "Flat" | "Studio" | "Other";
type PropertyStatus = "Available" | "Let" | "Sold" | "Off-market";

type Property = {
  id: string;
  displayAddress: string;
  postcode: string;
  type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  rentPcm: number | null;
  status: PropertyStatus;
  archived: boolean;
  createdAt: unknown;
  updatedAt: unknown;
  createdByUid: string;
};

function formatPropertyDate(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return new Date(v).toLocaleDateString();
  const t = v as { seconds?: number; toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toLocaleDateString();
  if (typeof t.seconds === "number") {
    return new Date(t.seconds * 1000).toLocaleDateString();
  }
  return String(v);
}

const PROPERTY_TYPES: PropertyType[] = ["House", "Flat", "Studio", "Other"];
const PROPERTY_STATUSES: PropertyStatus[] = [
  "Available",
  "Let",
  "Sold",
  "Off-market",
];

type AssignmentRow = {
  id: string;
  landlordUid: string;
  agencyId: string;
  propertyId: string;
  createdAt: unknown;
  status: string;
  email: string;
  displayName: string;
  primaryAgencyId?: string | null;
};

type LandlordOption = { uid: string; email: string; displayName: string; status?: string; agencyId?: string | null };

export default function AdminPropertyDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const propertyId = params?.propertyId as string | undefined;
  const { profile } = useAuth();
  const queryAgencyId = searchParams?.get("agencyId")?.trim() ?? null;
  const queryLandlordUid = searchParams?.get("landlordUid")?.trim() ?? null;
  const sessionAgencyId = profile?.agencyId ?? null;
  const effectiveAgencyId = queryAgencyId || sessionAgencyId;
  const isReadOnlyCrossAgency = !!effectiveAgencyId && effectiveAgencyId !== sessionAgencyId && profile?.role !== "superAdmin";

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Property>>({});

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [landlords, setLandlords] = useState<LandlordOption[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [selectedLandlordUid, setSelectedLandlordUid] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [unassignError, setUnassignError] = useState<string | null>(null);

  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const agencyId = effectiveAgencyId;
  const router = useRouter();

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const selectedLandlordPrimary = selectedLandlordUid
    ? (landlords.find((l) => l.uid === selectedLandlordUid)?.agencyId ?? null)
    : null;
  // Rule: only primary agency can assign/unassign; superAdmin bypasses (controls stay enabled).
  const isSuperAdmin = profile?.role === "superAdmin";
  const canAssignByPrimary =
    !isReadOnlyCrossAgency &&
    (isSuperAdmin || (!!agencyId && !!selectedLandlordUid && selectedLandlordPrimary === agencyId));
  const canAssign = canAssignByPrimary && !assignSubmitting;
  const anyUnassignRestricted = assignments.some(
    (a) => (a.primaryAgencyId ?? a.agencyId) !== agencyId
  );
  const showPrimaryHelper =
    !isSuperAdmin &&
    ((!!selectedLandlordUid && selectedLandlordPrimary != null && selectedLandlordPrimary !== agencyId) ||
      anyUnassignRestricted);
  const helperPrimary =
    selectedLandlordUid && selectedLandlordPrimary
      ? selectedLandlordPrimary
      : (() => {
          const restricted = assignments.find((a) => (a.primaryAgencyId ?? a.agencyId) !== agencyId);
          return restricted ? (restricted.primaryAgencyId ?? restricted.agencyId) : null;
        })();
  const isAdminRole =
    profile?.role === "admin" || profile?.role === "superAdmin";
  const db = getFirebaseFirestore();

  useEffect(() => {
    if (!propertyId) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    if (queryAgencyId || queryLandlordUid) {
      const q = new URLSearchParams();
      q.set("agencyId", effectiveAgencyId ?? "");
      if (queryLandlordUid) q.set("landlordUid", queryLandlordUid);
      fetch(`/api/admin/properties/${propertyId}?${q.toString()}`, { credentials: "include" })
        .then((res) => {
          setLoading(false);
          if (res.status === 403) {
            setForbidden(true);
            return null;
          }
          if (!res.ok) {
            setNotFound(true);
            return null;
          }
          return res.json();
        })
        .then((data: { id: string; displayAddress: string; postcode: string; type: string; bedrooms: number; bathrooms: number; rentPcm: number | null; status: string; archived: boolean; createdAtMs: number | null; updatedAtMs: number | null; createdByUid: string } | null) => {
          if (!data) return;
          const p: Property = {
            id: data.id,
            displayAddress: data.displayAddress ?? "",
            postcode: data.postcode ?? "",
            type: (data.type as PropertyType) ?? "House",
            bedrooms: Number(data.bedrooms) ?? 0,
            bathrooms: Number(data.bathrooms) ?? 0,
            rentPcm: data.rentPcm != null ? Number(data.rentPcm) : null,
            status: (data.status as PropertyStatus) ?? "Available",
            archived: data.archived === true,
            createdAt: data.createdAtMs ?? null,
            updatedAt: data.updatedAtMs ?? null,
            createdByUid: data.createdByUid ?? "",
          };
          setProperty(p);
          setEditForm({
            displayAddress: p.displayAddress,
            postcode: p.postcode,
            type: p.type,
            bedrooms: p.bedrooms,
            bathrooms: p.bathrooms,
            rentPcm: p.rentPcm,
            status: p.status,
          });
        })
        .catch(() => {
          setLoading(false);
          setNotFound(true);
        });
      return;
    }
    if (!db || !effectiveAgencyId) {
      setLoading(false);
      if (!effectiveAgencyId && sessionAgencyId) setNotFound(true);
      return;
    }
    const ref = doc(db, propertiesCol(effectiveAgencyId), propertyId);
    getDoc(ref).then((snap) => {
      setLoading(false);
      if (!snap.exists()) {
        setNotFound(true);
        return;
      }
      const data = snap.data()!;
      const p: Property = {
        id: snap.id,
        displayAddress: data.displayAddress ?? "",
        postcode: data.postcode ?? "",
        type: (data.type as PropertyType) ?? "House",
        bedrooms: Number(data.bedrooms) ?? 0,
        bathrooms: Number(data.bathrooms) ?? 0,
        rentPcm: data.rentPcm != null ? Number(data.rentPcm) : null,
        status: (data.status as PropertyStatus) ?? "Available",
        archived: data.archived === true,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdByUid: data.createdByUid ?? "",
      };
      setProperty(p);
      setEditForm({
        displayAddress: p.displayAddress,
        postcode: p.postcode,
        type: p.type,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        rentPcm: p.rentPcm,
        status: p.status,
      });
    });
  }, [db, effectiveAgencyId, sessionAgencyId, propertyId, queryAgencyId, queryLandlordUid]);

  const fetchAssignments = useCallback(() => {
    if (!propertyId) return;
    setLoadingAssignments(true);
    const query = new URLSearchParams();
    if (effectiveAgencyId) query.set("agencyId", effectiveAgencyId);
    if (queryLandlordUid) query.set("landlordUid", queryLandlordUid);
    const q = query.toString() ? `?${query.toString()}` : "";
    fetch(`/api/admin/properties/${propertyId}/assignments${q}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: AssignmentRow[]) => setAssignments(Array.isArray(data) ? data : []))
      .catch(() => setAssignments([]))
      .finally(() => setLoadingAssignments(false));
  }, [propertyId, effectiveAgencyId, queryLandlordUid]);

  useEffect(() => {
    if (!propertyId) return;
    fetchAssignments();
  }, [propertyId, fetchAssignments]);

  useEffect(() => {
    if (!profile || !isAdminRole) return;
    fetch("/api/admin/landlords", { credentials: "include" })
      .then((res) => {
        if (!res.ok) return [];
        return res.json();
      })
      .then((data: LandlordOption[]) => {
        const list = Array.isArray(data) ? data : [];
        setLandlords(list.filter((l) => l.status !== "disabled"));
      })
      .catch(() => setLandlords([]));
  }, [profile, isAdminRole]);

  const handleAssign = useCallback(() => {
    if (!propertyId || !selectedLandlordUid) return;
    setAssignError(null);
    setUnassignError(null);
    setAssignSubmitting(true);
    fetch(`/api/admin/properties/${propertyId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        landlordUid: selectedLandlordUid,
        ...(agencyId ? { agencyId } : {}),
      }),
    })
      .then((res) => {
        if (res.ok) {
          if (process.env.NODE_ENV !== "production") console.info("[Assign] success");
          fetchAssignments();
          setSelectedLandlordUid("");
          return;
        }
        if (res.status === 409) {
          setAssignError("Landlord is already assigned to this property.");
          if (process.env.NODE_ENV !== "production") console.info("[Assign] duplicate");
          return;
        }
        return res.json().then((d) => {
          const msg = d?.error ?? "Assign failed";
          setAssignError(msg);
          if (process.env.NODE_ENV !== "production") console.warn("[Assign] failed", msg);
        });
      })
      .catch(() => {
        setAssignError("Assign failed.");
        if (process.env.NODE_ENV !== "production") console.warn("[Assign] failed");
      })
      .finally(() => setAssignSubmitting(false));
  }, [propertyId, selectedLandlordUid, agencyId, fetchAssignments]);

  const handleUnassign = useCallback(
    (a: AssignmentRow) => {
      if (!propertyId) return;
      setUnassignError(null);
      const joinId = `${a.agencyId}_${a.propertyId}_${a.landlordUid}`;
      const fallback = { agencyId: a.agencyId, propertyId: a.propertyId, landlordUid: a.landlordUid };
      fetch(`/api/admin/property-landlords/${encodeURIComponent(joinId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(fallback),
      })
        .then(async (res) => {
          if (res.ok) {
            if (process.env.NODE_ENV !== "production") console.info("[Unassign] success");
            fetchAssignments();
            return;
          }
          const data = await res.json().catch(() => ({}));
          const msg = data?.error ?? `Unassign failed (${res.status})`;
          setUnassignError(msg);
          if (process.env.NODE_ENV !== "production") console.warn("[Unassign] failed", res.status, msg);
        })
        .catch(() => {
          setUnassignError("Unassign failed.");
          if (process.env.NODE_ENV !== "production") console.warn("[Unassign] failed");
        });
    },
    [propertyId, fetchAssignments]
  );

  const handleEditSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!db || !agencyId || !property) return;
      setSubmitting(true);
      try {
        const ref = doc(db, propertiesCol(agencyId), property.id);
        await updateDoc(ref, {
          displayAddress: editForm.displayAddress ?? property.displayAddress,
          postcode: editForm.postcode ?? property.postcode,
          type: editForm.type ?? property.type,
          bedrooms: editForm.bedrooms ?? property.bedrooms,
          bathrooms: editForm.bathrooms ?? property.bathrooms,
          rentPcm: editForm.rentPcm ?? property.rentPcm,
          status: editForm.status ?? property.status,
          updatedAt: serverTimestamp(),
        });
        setProperty((prev) =>
          prev
            ? {
                ...prev,
                ...editForm,
                updatedAt: null,
              }
            : null
        );
        setEditing(false);
      } finally {
        setSubmitting(false);
      }
    },
    [db, agencyId, property, editForm]
  );

  if (!agencyId) {
    return (
      <>
        <PageHeader title="Property" />
        <p className="text-sm text-zinc-500">No agency.</p>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Property" />
        <p className="text-sm text-zinc-500">Loading…</p>
      </>
    );
  }

  if (notFound || !property) {
    return (
      <>
        <PageHeader title="Property" />
        <p className="text-sm text-zinc-500">Property not found.</p>
        <Link
          href="/admin/properties"
          className="mt-2 inline-block text-sm font-medium text-zinc-600 hover:underline"
        >
          ← Back to properties
        </Link>
      </>
    );
  }

  if (forbidden) {
    return (
      <>
        <PageHeader title="Property" />
        <p className="text-sm text-zinc-500">You don&apos;t have access to this property.</p>
        <Link
          href="/admin/landlords"
          className="mt-2 inline-block text-sm font-medium text-zinc-600 hover:underline"
        >
          ← Back to Landlords
        </Link>
      </>
    );
  }

  return (
    <>
      {toast && (
        <div
          className="fixed bottom-4 right-4 z-20 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      )}

      <AdminCreateTicketModal
        open={createTicketOpen}
        onClose={() => setCreateTicketOpen(false)}
        initialProperty={
          property && agencyId
            ? {
                agencyId,
                propertyId: property.id,
                displayAddress: property.displayAddress,
                postcode: property.postcode,
              }
            : undefined
        }
        onSuccess={() => {
          setToast("Ticket created");
          setCreateTicketOpen(false);
          router.push("/admin/tickets");
        }}
      />

      <PageHeader
        title={property.displayAddress}
        action={
          <div className="flex gap-2">
            {isReadOnlyCrossAgency ? null : editing ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="property-edit-form"
                  disabled={submitting}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCreateTicketOpen(true)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Create ticket
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Edit
                </button>
              </>
            )}
            <Link
              href="/admin/properties"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              ← Back
            </Link>
          </div>
        }
      />

      {isReadOnlyCrossAgency && (
        <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800">
          Read-only (cross-agency). You can view this property but cannot edit or change landlord assignments.
        </div>
      )}

      {!editing && (
        <Card className="p-6">
          <dl className="grid gap-2 sm:grid-cols-2">
            <dt className="text-sm text-zinc-500">Address</dt>
            <dd className="font-medium text-zinc-900">
              {property.displayAddress}
            </dd>
            <dt className="text-sm text-zinc-500">Postcode</dt>
            <dd>{property.postcode}</dd>
            <dt className="text-sm text-zinc-500">Type</dt>
            <dd>{property.type}</dd>
            <dt className="text-sm text-zinc-500">Bedrooms</dt>
            <dd>{property.bedrooms}</dd>
            <dt className="text-sm text-zinc-500">Bathrooms</dt>
            <dd>{property.bathrooms}</dd>
            <dt className="text-sm text-zinc-500">Rent pcm</dt>
            <dd>
              {property.rentPcm != null ? `£${property.rentPcm}` : "—"}
            </dd>
            <dt className="text-sm text-zinc-500">Status</dt>
            <dd>{property.status}</dd>
            <dt className="text-sm text-zinc-500">Created</dt>
            <dd>{formatPropertyDate(property.createdAt)}</dd>
            <dt className="text-sm text-zinc-500">Updated</dt>
            <dd>{formatPropertyDate(property.updatedAt)}</dd>
          </dl>
        </Card>
      )}

      {!editing && (
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-medium text-zinc-900 mb-3">Assigned landlords</h2>
          {loadingAssignments ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-zinc-500">No landlords assigned yet.</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {assignments.map((a) => {
                const rowPrimary = a.primaryAgencyId ?? a.agencyId;
                const canUnassign = !isReadOnlyCrossAgency && (isSuperAdmin || (!!agencyId && rowPrimary === agencyId));
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded border border-zinc-200 bg-zinc-50/50 px-3 py-2"
                  >
                    <span className="text-sm text-zinc-900">
                      {a.displayName ? `${a.displayName}${a.email ? ` (${a.email})` : ""}` : a.email || a.landlordUid}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUnassign(a)}
                      disabled={!canUnassign}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Unassign
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-zinc-200">
            <div className="min-w-[200px]">
              <label htmlFor="assign-landlord" className="block text-sm font-medium text-zinc-700 mb-1">
                Assign landlord
              </label>
              <select
                id="assign-landlord"
                value={selectedLandlordUid}
                onChange={(e) => {
                  setSelectedLandlordUid(e.target.value);
                  setAssignError(null);
                  setUnassignError(null);
                }}
                className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              >
                <option value="">Select…</option>
                {landlords
                  .filter((l) => !assignments.some((a) => a.landlordUid === l.uid))
                  .map((l) => (
                    <option key={l.uid} value={l.uid}>
                      {l.displayName || l.email || l.uid}
                    </option>
                  ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleAssign}
              disabled={!canAssign}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assignSubmitting ? "Assigning…" : "Assign"}
            </button>
          </div>
          {showPrimaryHelper && helperPrimary ? (
            <p className="mt-2 text-sm text-zinc-500">
              Only primary agency ({helperPrimary}) can assign or unassign landlords. You can view but not change assignments for other agencies.
            </p>
          ) : null}
          {assignError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {assignError}
            </p>
          )}
          {unassignError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {unassignError}
            </p>
          )}
        </Card>
      )}

      {editing && (
        <Card className="p-6">
          <form
            id="property-edit-form"
            onSubmit={handleEditSave}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="edit-displayAddress"
                className="block text-sm font-medium text-zinc-700"
              >
                Display address *
              </label>
              <input
                id="edit-displayAddress"
                type="text"
                value={editForm.displayAddress ?? ""}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    displayAddress: e.target.value,
                  }))
                }
                required
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label
                htmlFor="edit-postcode"
                className="block text-sm font-medium text-zinc-700"
              >
                Postcode *
              </label>
              <input
                id="edit-postcode"
                type="text"
                value={editForm.postcode ?? ""}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, postcode: e.target.value }))
                }
                required
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label
                htmlFor="edit-type"
                className="block text-sm font-medium text-zinc-700"
              >
                Type
              </label>
              <select
                id="edit-type"
                value={editForm.type ?? ""}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    type: e.target.value as PropertyType,
                  }))
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="edit-bedrooms"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Bedrooms *
                </label>
                <input
                  id="edit-bedrooms"
                  type="number"
                  min={0}
                  value={editForm.bedrooms ?? ""}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      bedrooms:
                        e.target.value === ""
                          ? 0
                          : Number(e.target.value),
                    }))
                  }
                  required
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-bathrooms"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Bathrooms *
                </label>
                <input
                  id="edit-bathrooms"
                  type="number"
                  min={0}
                  value={editForm.bathrooms ?? ""}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      bathrooms:
                        e.target.value === ""
                          ? 0
                          : Number(e.target.value),
                    }))
                  }
                  required
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="edit-rentPcm"
                className="block text-sm font-medium text-zinc-700"
              >
                Rent pcm (optional)
              </label>
              <input
                id="edit-rentPcm"
                type="number"
                min={0}
                step={1}
                value={
                  editForm.rentPcm === undefined ||
                  editForm.rentPcm === null
                    ? ""
                    : editForm.rentPcm
                }
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    rentPcm:
                      e.target.value === ""
                        ? null
                        : Number(e.target.value),
                  }))
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label
                htmlFor="edit-status"
                className="block text-sm font-medium text-zinc-700"
              >
                Status
              </label>
              <select
                id="edit-status"
                value={editForm.status ?? ""}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    status: e.target.value as PropertyStatus,
                  }))
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              >
                {PROPERTY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}
