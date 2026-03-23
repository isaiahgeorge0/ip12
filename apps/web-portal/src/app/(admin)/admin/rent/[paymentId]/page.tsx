"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { HistoryBackLink } from "@/components/HistoryBackLink";
import { EmptyState } from "@/components/EmptyState";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";
import { useAdminAgency } from "@/lib/admin/useAdminAgency";
import {
  RENT_PAYMENT_STATUSES,
  RENT_PAYMENT_STATUS_LABELS,
  type RentPaymentStatus,
} from "@/lib/types/rentPayment";

type RentPaymentDetail = {
  id: string;
  agencyId: string;
  tenancyId: string;
  propertyId: string;
  propertyDisplayLabel: string | null;
  tenantName: string;
  rentAmount: number;
  dueDate: string;
  status: RentPaymentStatus;
  paidAt: number | null;
  amountPaid: number | null;
  notes: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  createdBy: string;
};

function formatMoney(amount: number | null | undefined): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function AdminRentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const paymentId = params?.paymentId as string | undefined;
  const queryAgencyId = searchParams?.get("agencyId")?.trim() ?? null;
  const { effectiveAgencyId: ctxAgencyId, isSuperAdmin } = useAdminAgency();
  const effectiveAgencyId = queryAgencyId || ctxAgencyId;

  const [payment, setPayment] = useState<RentPaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [status, setStatus] = useState<RentPaymentStatus>("due");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [rentAmountEdit, setRentAmountEdit] = useState<string>("");

  const query = effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "";

  const loadPayment = useCallback(() => {
    if (!paymentId || !effectiveAgencyId) {
      setLoading(false);
      if (!paymentId || (!effectiveAgencyId && !isSuperAdmin)) {
        setNotFound(true);
      }
      return;
    }
    setLoading(true);
    fetch(`/api/admin/rent/${paymentId}${query}`, { credentials: "include" })
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: RentPaymentDetail | null) => {
        if (data) {
          setPayment(data);
          setStatus(data.status);
          setAmountPaid(data.amountPaid != null ? String(data.amountPaid) : "");
          setNotes(data.notes ?? "");
          setRentAmountEdit(data.rentAmount ? String(data.rentAmount) : "");
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [paymentId, effectiveAgencyId, query, isSuperAdmin]);

  useEffect(() => {
    loadPayment();
  }, [loadPayment]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSave = useCallback(
    (opts?: { markPaid?: boolean }) => {
      if (!paymentId || !effectiveAgencyId || !payment) return;
      const markPaid = opts?.markPaid ?? false;
      const nextStatus: RentPaymentStatus = markPaid ? "paid" : status;

      const parsedAmountPaid =
        amountPaid.trim() === ""
          ? null
          : Number.isFinite(Number(amountPaid)) && Number(amountPaid) >= 0
            ? Number(amountPaid)
            : NaN;
      if (parsedAmountPaid != null && !Number.isFinite(parsedAmountPaid)) {
        setToast("Amount paid must be a number >= 0.");
        return;
      }

      const parsedRentAmount =
        rentAmountEdit.trim() === ""
          ? undefined
          : Number.isFinite(Number(rentAmountEdit)) && Number(rentAmountEdit) >= 0
            ? Number(rentAmountEdit)
            : NaN;
      if (parsedRentAmount !== undefined && !Number.isFinite(parsedRentAmount)) {
        setToast("Rent amount must be a number >= 0.");
        return;
      }

      setSubmitting(true);
      fetch(`/api/admin/rent/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          agencyId: effectiveAgencyId,
          status: nextStatus,
          amountPaid: parsedAmountPaid,
          notes: notes.trim() || null,
          rentAmount: parsedRentAmount,
        }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            setToast("Rent payment updated");
            loadPayment();
          } else {
            setToast((data?.error as string) ?? "Update failed");
          }
        })
        .catch(() => setToast("Update failed"))
        .finally(() => setSubmitting(false));
    },
    [paymentId, effectiveAgencyId, payment, status, amountPaid, notes, rentAmountEdit, loadPayment]
  );

  if (!paymentId) {
    return (
      <>
        <PageHeader title="Rent payment" />
        <p className="text-sm text-zinc-500">Missing payment ID.</p>
      </>
    );
  }

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <PageHeader title="Rent payment" />
        <EmptyState title="No agency" description="Your account is not linked to an agency." />
      </>
    );
  }

  if (isSuperAdmin && !effectiveAgencyId) {
    return (
      <>
        <PageHeader title="Rent payment" />
        <EmptyState
          title="Select an agency from the header to view this page."
          description="Use the agency dropdown in the top bar."
        />
      </>
    );
  }

  if (loading || !payment) {
    return (
      <>
        <HistoryBackLink href={`/admin/rent${query}`}>← Rent payments</HistoryBackLink>
        <PageHeader title="Rent payment" />
        <p className="text-sm text-zinc-500">{notFound ? "Payment not found." : "Loading…"}</p>
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
      <HistoryBackLink href={`/admin/rent${query}`}>← Rent payments</HistoryBackLink>
      <PageHeader title="Rent payment detail" />

      <div className="space-y-6">
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Summary</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-zinc-500">Tenant</dt>
            <dd className="text-zinc-900">{payment.tenantName}</dd>
            <dt className="text-zinc-500">Property</dt>
            <dd className="text-zinc-900">
              <Link
                href={`/admin/properties/${payment.propertyId}${query}`}
                className="hover:underline"
              >
                {payment.propertyDisplayLabel || payment.propertyId || "—"}
              </Link>
            </dd>
            <dt className="text-zinc-500">Tenancy</dt>
            <dd className="text-zinc-900">
              {payment.tenancyId ? (
                <Link
                  href={`/admin/tenancies/${payment.tenancyId}${query}`}
                  className="hover:underline"
                >
                  Open tenancy
                </Link>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-zinc-500">Rent amount</dt>
            <dd className="text-zinc-900">{formatMoney(payment.rentAmount)}</dd>
            <dt className="text-zinc-500">Due date</dt>
            <dd className="text-zinc-900">{payment.dueDate || "—"}</dd>
            <dt className="text-zinc-500">Status</dt>
            <dd className="text-zinc-900">
              <AdminStatusBadge variant={getStatusBadgeVariant(payment.status, "rent")}>
                {RENT_PAYMENT_STATUS_LABELS[payment.status]}
              </AdminStatusBadge>
            </dd>
          </dl>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Payment info</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
            <dt className="text-zinc-500">Paid at</dt>
            <dd className="text-zinc-900">{formatAdminDate(payment.paidAt, "dateTime")}</dd>
            <dt className="text-zinc-500">Amount paid</dt>
            <dd className="text-zinc-900">{formatMoney(payment.amountPaid)}</dd>
            <dt className="text-zinc-500">Notes</dt>
            <dd className="text-zinc-900 whitespace-pre-wrap">
              {payment.notes && payment.notes.trim() ? payment.notes : "—"}
            </dd>
          </dl>

          <div className="border-t border-zinc-200 pt-3 mt-2">
            <h3 className="text-xs font-semibold text-zinc-700 mb-2">Update payment</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RentPaymentStatus)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                >
                  {RENT_PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {RENT_PAYMENT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Amount paid</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Rent amount</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={rentAmountEdit}
                  onChange={(e) => setRentAmountEdit(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-zinc-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={submitting}
                className="inline-flex items-center rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                Save changes
              </button>
              <button
                type="button"
                onClick={() => handleSave({ markPaid: true })}
                disabled={submitting}
                className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Mark paid
              </button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

