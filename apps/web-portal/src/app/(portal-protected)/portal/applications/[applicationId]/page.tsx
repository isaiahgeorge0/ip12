"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { HistoryBackLink } from "@/components/HistoryBackLink";
import { EMPLOYMENT_STATUSES } from "@/lib/types/applicantProfile";
import { APPLICATION_PROGRESS_STATUSES, type ApplicationProgressStatus } from "@/lib/types/applicationForm";

type ApplicationData = {
  id: string;
  agencyId: string;
  propertyDisplayLabel: string;
  fullName: string;
  email: string;
  phone: string | null;
  applicationProgressStatus: ApplicationProgressStatus;
  dateOfBirth?: string | null;
  currentAddressLine1?: string | null;
  currentAddressLine2?: string | null;
  currentCity?: string | null;
  currentPostcode?: string | null;
  reasonForMoving?: string | null;
  intendedOccupants?: number | null;
  hasChildren?: boolean | null;
  hasPets?: boolean | null;
  petDetails?: string | null;
  smoker?: boolean | null;
  moveInDate?: string | null;
  employmentStatus?: string | null;
  employerName?: string | null;
  jobTitle?: string | null;
  monthlyIncome?: number | null;
  annualIncome?: number | null;
  additionalIncomeNotes?: string | null;
  guarantorRequired?: boolean | null;
  guarantorOffered?: boolean | null;
  guarantorNotes?: string | null;
  affordabilityNotes?: string | null;
  extraNotes?: string | null;
};

const emptyForm: ApplicationData = {
  id: "",
  agencyId: "",
  propertyDisplayLabel: "",
  fullName: "",
  email: "",
  phone: null,
  applicationProgressStatus: "draft",
};

function validateSubmit(form: ApplicationData): string | null {
  if (!form.fullName?.trim()) return "Full name is required.";
  if (!form.email?.trim()) return "Email is required.";
  if (!form.phone?.trim()) return "Phone is required.";
  if (form.monthlyIncome != null && (typeof form.monthlyIncome !== "number" || form.monthlyIncome < 0))
    return "Monthly income must be a positive number.";
  if (form.annualIncome != null && (typeof form.annualIncome !== "number" || form.annualIncome < 0))
    return "Annual income must be a positive number.";
  if (form.intendedOccupants != null && (typeof form.intendedOccupants !== "number" || form.intendedOccupants < 0))
    return "Intended occupants must be a positive number.";
  return null;
}

export default function PortalApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params?.applicationId as string | undefined;
  const [data, setData] = useState<ApplicationData | null>(null);
  const [form, setForm] = useState<ApplicationData>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!applicationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/portal/applications/${applicationId}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((res) => {
        if (!res) {
          setData(null);
          setForm(emptyForm);
          return;
        }
        const d: ApplicationData = {
          id: res.id,
          agencyId: res.agencyId,
          propertyDisplayLabel: res.propertyDisplayLabel ?? `Property ${res.sourcePropertyId ?? ""}`,
          fullName: res.fullName ?? "",
          email: res.email ?? "",
          phone: res.phone ?? null,
          applicationProgressStatus: (APPLICATION_PROGRESS_STATUSES as readonly string[]).includes(res.applicationProgressStatus) ? res.applicationProgressStatus : "draft",
          dateOfBirth: res.dateOfBirth ?? null,
          currentAddressLine1: res.currentAddressLine1 ?? null,
          currentAddressLine2: res.currentAddressLine2 ?? null,
          currentCity: res.currentCity ?? null,
          currentPostcode: res.currentPostcode ?? null,
          reasonForMoving: res.reasonForMoving ?? null,
          intendedOccupants: res.intendedOccupants ?? null,
          hasChildren: res.hasChildren ?? null,
          hasPets: res.hasPets ?? null,
          petDetails: res.petDetails ?? null,
          smoker: res.smoker ?? null,
          moveInDate: res.moveInDate ?? null,
          employmentStatus: res.employmentStatus ?? null,
          employerName: res.employerName ?? null,
          jobTitle: res.jobTitle ?? null,
          monthlyIncome: res.monthlyIncome ?? null,
          annualIncome: res.annualIncome ?? null,
          additionalIncomeNotes: res.additionalIncomeNotes ?? null,
          guarantorRequired: res.guarantorRequired ?? null,
          guarantorOffered: res.guarantorOffered ?? null,
          guarantorNotes: res.guarantorNotes ?? null,
          affordabilityNotes: res.affordabilityNotes ?? null,
          extraNotes: res.extraNotes ?? null,
        };
        setData(d);
        setForm(d);
      })
      .catch(() => {
        setData(null);
        setForm(emptyForm);
      })
      .finally(() => setLoading(false));
  }, [applicationId]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const save = useCallback(
    (submit: boolean) => {
      if (!applicationId || !data) return;
      setError(null);
      if (submit) {
        const err = validateSubmit(form);
        if (err) {
          setError(err);
          return;
        }
      }
      setSaving(true);
      const body: Record<string, unknown> = {
        fullName: form.fullName?.trim() ?? "",
        email: form.email?.trim() ?? "",
        phone: form.phone?.trim() || null,
        dateOfBirth: form.dateOfBirth?.trim() || null,
        currentAddressLine1: form.currentAddressLine1?.trim() || null,
        currentAddressLine2: form.currentAddressLine2?.trim() || null,
        currentCity: form.currentCity?.trim() || null,
        currentPostcode: form.currentPostcode?.trim() || null,
        reasonForMoving: form.reasonForMoving?.trim() || null,
        intendedOccupants: form.intendedOccupants ?? null,
        hasChildren: form.hasChildren ?? null,
        hasPets: form.hasPets ?? null,
        petDetails: form.petDetails?.trim() || null,
        smoker: form.smoker ?? null,
        moveInDate: form.moveInDate?.trim() || null,
        employmentStatus: form.employmentStatus?.trim() || null,
        employerName: form.employerName?.trim() || null,
        jobTitle: form.jobTitle?.trim() || null,
        monthlyIncome: form.monthlyIncome ?? null,
        annualIncome: form.annualIncome ?? null,
        additionalIncomeNotes: form.additionalIncomeNotes?.trim() || null,
        guarantorRequired: form.guarantorRequired ?? null,
        guarantorOffered: form.guarantorOffered ?? null,
        guarantorNotes: form.guarantorNotes?.trim() || null,
        affordabilityNotes: form.affordabilityNotes?.trim() || null,
        extraNotes: form.extraNotes?.trim() || null,
      };
      if (submit) body.applicationProgressStatus = "submitted";
      fetch(`/api/portal/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
        .then((r) => {
          if (r.ok) {
            setToast(submit ? "Application submitted" : "Saved");
            setData((prev) => (prev ? { ...prev, ...body, applicationProgressStatus: submit ? "submitted" : prev.applicationProgressStatus } : null));
            setForm((prev) => ({ ...prev, ...body, applicationProgressStatus: submit ? "submitted" : prev.applicationProgressStatus }));
            if (submit) router.refresh();
          } else {
            return r.json().then((d: { error?: string }) => {
              setError(d?.error ?? "Failed to save");
            });
          }
        })
        .catch(() => setError("Failed to save"))
        .finally(() => setSaving(false));
    },
    [applicationId, data, form, router]
  );

  if (!applicationId || (!loading && !data)) {
    return (
      <>
        <PageHeader title="Application" />
        <Card className="p-6">
          <p className="text-zinc-600">Application not found.</p>
          <HistoryBackLink href="/portal/applications" className="mt-4 inline-block">
            ← Back to applications
          </HistoryBackLink>
        </Card>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Application" />
        <p className="text-sm text-zinc-500">Loading…</p>
      </>
    );
  }

  const statusBanner =
    form.applicationProgressStatus === "submitted"
      ? "Submitted"
      : form.applicationProgressStatus === "in_progress"
        ? "In progress"
        : "Draft";

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
        title={form.propertyDisplayLabel || "Application"}
        action={
          <HistoryBackLink href="/portal/applications" className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            ← Back to applications
          </HistoryBackLink>
        }
      />
      <div className="mb-4 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2">
        <p className="text-sm font-medium text-zinc-700">Status: {statusBanner}</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
        className="space-y-6"
      >
        <Card className="p-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">Personal details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-zinc-700">Full name *</label>
              <input
                id="fullName"
                type="text"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700">Email *</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-zinc-700">Phone *</label>
              <input
                id="phone"
                type="tel"
                value={form.phone ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value.trim() || null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label htmlFor="dateOfBirth" className="block text-sm font-medium text-zinc-700">Date of birth</label>
              <input
                id="dateOfBirth"
                type="date"
                value={form.dateOfBirth ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, dateOfBirth: e.target.value || null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">Current address</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="currentAddressLine1" className="block text-sm font-medium text-zinc-700">Address line 1</label>
              <input
                id="currentAddressLine1"
                type="text"
                value={form.currentAddressLine1 ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, currentAddressLine1: e.target.value || null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="currentAddressLine2" className="block text-sm font-medium text-zinc-700">Address line 2</label>
              <input
                id="currentAddressLine2"
                type="text"
                value={form.currentAddressLine2 ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, currentAddressLine2: e.target.value || null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label htmlFor="currentCity" className="block text-sm font-medium text-zinc-700">City</label>
              <input
                id="currentCity"
                type="text"
                value={form.currentCity ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, currentCity: e.target.value || null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label htmlFor="currentPostcode" className="block text-sm font-medium text-zinc-700">Postcode</label>
              <input
                id="currentPostcode"
                type="text"
                value={form.currentPostcode ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, currentPostcode: e.target.value || null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">Occupancy & move</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="intendedOccupants" className="block text-sm font-medium text-zinc-700">Intended occupants</label>
              <input
                id="intendedOccupants"
                type="number"
                min={0}
                value={form.intendedOccupants ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, intendedOccupants: e.target.value === "" ? null : parseInt(e.target.value, 10) }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label htmlFor="moveInDate" className="block text-sm font-medium text-zinc-700">Preferred move-in date</label>
              <input
                id="moveInDate"
                type="date"
                value={form.moveInDate ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, moveInDate: e.target.value || null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="reasonForMoving" className="block text-sm font-medium text-zinc-700">Reason for moving</label>
              <textarea
                id="reasonForMoving"
                rows={2}
                value={form.reasonForMoving ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, reasonForMoving: e.target.value || null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Has children?</label>
              <select
                value={form.hasChildren === true ? "yes" : form.hasChildren === false ? "no" : ""}
                onChange={(e) => setForm((p) => ({ ...p, hasChildren: e.target.value === "yes" ? true : e.target.value === "no" ? false : null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Has pets?</label>
              <select
                value={form.hasPets === true ? "yes" : form.hasPets === false ? "no" : ""}
                onChange={(e) => setForm((p) => ({ ...p, hasPets: e.target.value === "yes" ? true : e.target.value === "no" ? false : null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            {form.hasPets && (
              <div className="sm:col-span-2">
                <label htmlFor="petDetails" className="block text-sm font-medium text-zinc-700">Pet details</label>
                <textarea
                  id="petDetails"
                  rows={2}
                  value={form.petDetails ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, petDetails: e.target.value || null }))}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-zinc-700">Smoker?</label>
              <select
                value={form.smoker === true ? "yes" : form.smoker === false ? "no" : ""}
                onChange={(e) => setForm((p) => ({ ...p, smoker: e.target.value === "yes" ? true : e.target.value === "no" ? false : null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">Employment & income</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="employmentStatus" className="block text-sm font-medium text-zinc-700">Employment status</label>
              <select
                id="employmentStatus"
                value={form.employmentStatus ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, employmentStatus: e.target.value || null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              >
                <option value="">—</option>
                {EMPLOYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="employerName" className="block text-sm font-medium text-zinc-700">Employer name</label>
              <input
                id="employerName"
                type="text"
                value={form.employerName ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, employerName: e.target.value || null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label htmlFor="jobTitle" className="block text-sm font-medium text-zinc-700">Job title</label>
              <input
                id="jobTitle"
                type="text"
                value={form.jobTitle ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, jobTitle: e.target.value || null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label htmlFor="monthlyIncome" className="block text-sm font-medium text-zinc-700">Monthly income (£)</label>
              <input
                id="monthlyIncome"
                type="number"
                min={0}
                step={0.01}
                value={form.monthlyIncome ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, monthlyIncome: e.target.value === "" ? null : parseFloat(e.target.value) }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label htmlFor="annualIncome" className="block text-sm font-medium text-zinc-700">Annual income (£)</label>
              <input
                id="annualIncome"
                type="number"
                min={0}
                step={0.01}
                value={form.annualIncome ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, annualIncome: e.target.value === "" ? null : parseFloat(e.target.value) }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="additionalIncomeNotes" className="block text-sm font-medium text-zinc-700">Additional income notes</label>
              <textarea
                id="additionalIncomeNotes"
                rows={2}
                value={form.additionalIncomeNotes ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, additionalIncomeNotes: e.target.value || null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Guarantor required?</label>
              <select
                value={form.guarantorRequired === true ? "yes" : form.guarantorRequired === false ? "no" : ""}
                onChange={(e) => setForm((p) => ({ ...p, guarantorRequired: e.target.value === "yes" ? true : e.target.value === "no" ? false : null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Guarantor offered?</label>
              <select
                value={form.guarantorOffered === true ? "yes" : form.guarantorOffered === false ? "no" : ""}
                onChange={(e) => setForm((p) => ({ ...p, guarantorOffered: e.target.value === "yes" ? true : e.target.value === "no" ? false : null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="guarantorNotes" className="block text-sm font-medium text-zinc-700">Guarantor notes</label>
              <textarea
                id="guarantorNotes"
                rows={2}
                value={form.guarantorNotes ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, guarantorNotes: e.target.value || null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="affordabilityNotes" className="block text-sm font-medium text-zinc-700">Affordability notes</label>
              <textarea
                id="affordabilityNotes"
                rows={2}
                value={form.affordabilityNotes ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, affordabilityNotes: e.target.value || null }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">Extra notes</h2>
          <textarea
            id="extraNotes"
            rows={4}
            value={form.extraNotes ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, extraNotes: e.target.value || null }))}
            className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
          />
        </Card>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => save(false)}
            disabled={saving}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save application"}
          </button>
          {form.applicationProgressStatus !== "submitted" && (
            <button
              type="button"
              onClick={() => save(true)}
              disabled={saving}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Submit application"}
            </button>
          )}
        </div>
      </form>
    </>
  );
}
