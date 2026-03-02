"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  orderBy,
  query,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { propertiesCol } from "@/lib/firestore/paths";

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
  const t = v as { seconds?: number; toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toLocaleDateString();
  if (typeof t.seconds === "number") {
    return new Date(t.seconds * 1000).toLocaleDateString();
  }
  return String(v);
}

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Available: "bg-green-100 text-green-800",
    Let: "bg-blue-100 text-blue-800",
    Sold: "bg-zinc-100 text-zinc-700",
    "Off-market": "bg-zinc-100 text-zinc-600",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-zinc-100 text-zinc-700"}`}
    >
      {status}
    </span>
  );
}

const PROPERTY_TYPES: PropertyType[] = ["House", "Flat", "Studio", "Other"];
const PROPERTY_STATUSES: PropertyStatus[] = [
  "Available",
  "Let",
  "Sold",
  "Off-market",
];

const defaultCreateForm = {
  displayAddress: "",
  postcode: "",
  type: "House" as PropertyType,
  bedrooms: 0,
  bathrooms: 0,
  rentPcm: "" as number | "",
  status: "Available" as PropertyStatus,
};

export default function AdminPropertiesPage() {
  const { profile, user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [toast, setToast] = useState<string | null>(null);

  const agencyId = profile?.agencyId ?? null;
  const db = getFirebaseFirestore();

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (!db || !agencyId) {
      setLoading(false);
      setProperties([]);
      return;
    }
    const colRef = collection(db, propertiesCol(agencyId));
    const q = query(colRef, orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Property[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
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
        });
        setProperties(list.filter((p) => !p.archived));
        setLoading(false);
      },
      () => {
        setProperties([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [db, agencyId]);

  const handleCreateSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!db || !agencyId || !user) return;
      const rentPcm =
        createForm.rentPcm === "" ? null : Number(createForm.rentPcm);
      if (
        !createForm.displayAddress.trim() ||
        !createForm.postcode.trim() ||
        Number(createForm.bedrooms) < 0 ||
        Number(createForm.bathrooms) < 0
      ) {
        return;
      }
      setSubmitting(true);
      try {
        const colRef = collection(db, propertiesCol(agencyId));
        await addDoc(colRef, {
          displayAddress: createForm.displayAddress.trim(),
          postcode: createForm.postcode.trim(),
          type: createForm.type,
          bedrooms: Number(createForm.bedrooms),
          bathrooms: Number(createForm.bathrooms),
          rentPcm: rentPcm ?? null,
          status: createForm.status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdByUid: user.uid,
          archived: false,
        });
        setCreateForm(defaultCreateForm);
        setCreateOpen(false);
        setToast("Property created");
      } finally {
        setSubmitting(false);
      }
    },
    [db, agencyId, user, createForm]
  );

  if (!agencyId) {
    return (
      <>
        <PageHeader title="Properties" />
        <EmptyState
          title="No agency"
          description="Your account is not linked to an agency."
        />
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

      <PageHeader
        title="Properties"
        action={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Create property
          </button>
        }
      />

      {loading && (
        <div className="text-sm text-zinc-500">Loading properties…</div>
      )}

      {!loading && properties.length === 0 && (
        <EmptyState
          title="No properties yet"
          description="Create a property to get started."
          action={
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Create property
            </button>
          }
        />
      )}

      {!loading && properties.length > 0 && (
        <div className="space-y-2">
          {properties.map((prop) => (
            <Link key={prop.id} href={`/admin/properties/${prop.id}`}>
              <Card className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between hover:border-zinc-400 transition-colors">
                <div>
                  <p className="font-medium text-zinc-900">
                    {prop.displayAddress}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {prop.postcode} · {prop.type} · {prop.bedrooms} bed,{" "}
                    {prop.bathrooms} bath
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip status={prop.status} />
                  {prop.rentPcm != null && (
                    <span className="text-sm text-zinc-600">
                      £{prop.rentPcm}/mo
                    </span>
                  )}
                  <span className="text-sm text-zinc-500">
                    {formatPropertyDate(prop.updatedAt)}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {createOpen && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-property-title"
        >
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2
              id="create-property-title"
              className="text-lg font-semibold text-zinc-900"
            >
              Create property
            </h2>
            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="prop-displayAddress"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Display address *
                </label>
                <input
                  id="prop-displayAddress"
                  type="text"
                  value={createForm.displayAddress}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      displayAddress: e.target.value,
                    }))
                  }
                  required
                  placeholder="12 Example Street, Ipswich"
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div>
                <label
                  htmlFor="prop-postcode"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Postcode *
                </label>
                <input
                  id="prop-postcode"
                  type="text"
                  value={createForm.postcode}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, postcode: e.target.value }))
                  }
                  required
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div>
                <label
                  htmlFor="prop-type"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Type
                </label>
                <select
                  id="prop-type"
                  value={createForm.type}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
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
                    htmlFor="prop-bedrooms"
                    className="block text-sm font-medium text-zinc-700"
                  >
                    Bedrooms *
                  </label>
                  <input
                    id="prop-bedrooms"
                    type="number"
                    min={0}
                    value={createForm.bedrooms || ""}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        bedrooms: e.target.value === "" ? 0 : Number(e.target.value),
                      }))
                    }
                    required
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="prop-bathrooms"
                    className="block text-sm font-medium text-zinc-700"
                  >
                    Bathrooms *
                  </label>
                  <input
                    id="prop-bathrooms"
                    type="number"
                    min={0}
                    value={createForm.bathrooms || ""}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        bathrooms: e.target.value === "" ? 0 : Number(e.target.value),
                      }))
                    }
                    required
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="prop-rentPcm"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Rent pcm (optional)
                </label>
                <input
                  id="prop-rentPcm"
                  type="number"
                  min={0}
                  step={1}
                  value={createForm.rentPcm === "" ? "" : createForm.rentPcm}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      rentPcm:
                        e.target.value === "" ? "" : Number(e.target.value),
                    }))
                  }
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div>
                <label
                  htmlFor="prop-status"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Status
                </label>
                <select
                  id="prop-status"
                  value={createForm.status}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
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
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {submitting ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
