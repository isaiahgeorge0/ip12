"use client";

import { useState, useCallback, useEffect } from "react";
import { Card } from "@/components/Card";
import type { ApplicantProfile } from "@/lib/types/applicantProfile";
import { EMPLOYMENT_STATUSES } from "@/lib/types/applicantProfile";

export type EnquiryListingContext = {
  agencyId: string;
  propertyId: string;
  docId: string;
  displayAddress?: string;
};

type Props = {
  listing: EnquiryListingContext;
  defaultName: string;
  defaultEmail: string;
  defaultPhone?: string;
  /** Prefill from applicant profile when available (fetched by parent or passed in). */
  applicantProfile?: ApplicantProfile | null;
  onClose: () => void;
  onSuccess: () => void;
};

const MESSAGE_MIN = 10;
const MESSAGE_MAX = 2000;
const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  self_employed: "Self-employed",
  unemployed: "Unemployed",
  student: "Student",
  retired: "Retired",
  other: "Other",
};

export function EnquiryModal({
  listing,
  defaultName,
  defaultEmail,
  defaultPhone = "",
  applicantProfile = null,
  onClose,
  onSuccess,
}: Props) {
  const [message, setMessage] = useState("");
  const [applicantName, setApplicantName] = useState(defaultName);
  const [applicantPhone, setApplicantPhone] = useState(defaultPhone);
  const [moveInDate, setMoveInDate] = useState("");
  const [hasPets, setHasPets] = useState<boolean | "">("");
  const [petDetails, setPetDetails] = useState("");
  const [hasChildren, setHasChildren] = useState<boolean | "">("");
  const [employmentStatus, setEmploymentStatus] = useState("");
  const [smoker, setSmoker] = useState<boolean | "">("");
  const [intendedOccupants, setIntendedOccupants] = useState("");
  const [incomeNotes, setIncomeNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Prefill from applicant profile when it loads or changes
  useEffect(() => {
    if (applicantProfile) {
      if (applicantProfile.fullName) setApplicantName(applicantProfile.fullName);
      if (applicantProfile.phone) setApplicantPhone(applicantProfile.phone);
      if (applicantProfile.hasPets != null) setHasPets(applicantProfile.hasPets);
      if (applicantProfile.petDetails) setPetDetails(applicantProfile.petDetails);
      if (applicantProfile.hasChildren != null) setHasChildren(applicantProfile.hasChildren);
      if (applicantProfile.employmentStatus) setEmploymentStatus(applicantProfile.employmentStatus);
      if (applicantProfile.smoker != null) setSmoker(applicantProfile.smoker);
      if (applicantProfile.intendedOccupants != null) setIntendedOccupants(String(applicantProfile.intendedOccupants));
      if (applicantProfile.incomeNotes) setIncomeNotes(applicantProfile.incomeNotes);
    }
  }, [applicantProfile]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const msg = message.trim();
      if (msg.length < MESSAGE_MIN) {
        setError(`Please enter at least ${MESSAGE_MIN} characters for your message.`);
        return;
      }
      if (msg.length > MESSAGE_MAX) {
        setError(`Message must be ${MESSAGE_MAX} characters or less.`);
        return;
      }
      const occupantsNum = intendedOccupants.trim() === "" ? undefined : parseInt(intendedOccupants, 10);
      if (intendedOccupants.trim() !== "" && (Number.isNaN(occupantsNum) || occupantsNum! < 1)) {
        setError("Intended occupants must be a positive number if provided.");
        return;
      }
      const moveInParsed = moveInDate.trim() ? new Date(moveInDate) : null;
      if (moveInDate.trim() && moveInParsed && Number.isNaN(moveInParsed.getTime())) {
        setError("Please enter a valid move-in date.");
        return;
      }
      setError(null);
      setSubmitting(true);
      try {
        const payload: Record<string, unknown> = {
          agencyId: listing.agencyId,
          propertyId: listing.propertyId,
          message: msg,
          applicantName: applicantName.trim() || undefined,
          applicantPhone: applicantPhone.trim() || undefined,
          moveInDate: moveInDate.trim() || undefined,
          hasPets: hasPets === true || hasPets === false ? hasPets : undefined,
          petDetails: hasPets === true && petDetails.trim() ? petDetails.trim() : undefined,
          hasChildren: hasChildren === true || hasChildren === false ? hasChildren : undefined,
          employmentStatus: employmentStatus.trim() || undefined,
          smoker: smoker === true || smoker === false ? smoker : undefined,
          intendedOccupants: occupantsNum,
          incomeNotes: incomeNotes.trim() || undefined,
        };
        const res = await fetch("/api/enquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; enquiryId?: string };
        if (!res.ok) {
          setError(data?.error ?? `Request failed (${res.status})`);
          return;
        }
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setSubmitting(false);
      }
    },
    [
      listing,
      message,
      applicantName,
      applicantPhone,
      moveInDate,
      hasPets,
      petDetails,
      hasChildren,
      employmentStatus,
      smoker,
      intendedOccupants,
      incomeNotes,
      onSuccess,
      onClose,
    ]
  );

  if (success) {
    return (
      <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
        <Card className="w-full max-w-md p-6 text-center">
          <p className="text-lg font-medium text-zinc-900">Enquiry sent</p>
          <p className="mt-2 text-sm text-zinc-600">Thank you. The agent will be in touch.</p>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enquiry-modal-title"
    >
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 id="enquiry-modal-title" className="text-lg font-semibold text-zinc-900">
          Enquire about this property
        </h2>
        {listing.displayAddress && (
          <p className="mt-1 text-sm text-zinc-600">{listing.displayAddress}</p>
        )}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="enquiry-name" className="block text-sm font-medium text-zinc-700">
              Your name *
            </label>
            <input
              id="enquiry-name"
              type="text"
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
          </div>
          <div>
            <label htmlFor="enquiry-email" className="block text-sm font-medium text-zinc-700">
              Email *
            </label>
            <input
              id="enquiry-email"
              type="email"
              value={defaultEmail}
              readOnly
              className="mt-1 block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-600"
            />
            <p className="mt-0.5 text-xs text-zinc-500">From your account</p>
          </div>
          <div>
            <label htmlFor="enquiry-phone" className="block text-sm font-medium text-zinc-700">
              Phone (optional)
            </label>
            <input
              id="enquiry-phone"
              type="tel"
              value={applicantPhone}
              onChange={(e) => setApplicantPhone(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
          </div>
          <div>
            <label htmlFor="enquiry-moveIn" className="block text-sm font-medium text-zinc-700">
              Preferred move-in date (optional)
            </label>
            <input
              id="enquiry-moveIn"
              type="date"
              value={moveInDate}
              onChange={(e) => setMoveInDate(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
          </div>
          <div>
            <label htmlFor="enquiry-message" className="block text-sm font-medium text-zinc-700">
              Message * (min {MESSAGE_MIN} characters)
            </label>
            <textarea
              id="enquiry-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              minLength={MESSAGE_MIN}
              maxLength={MESSAGE_MAX}
              placeholder="e.g. I'd like to arrange a viewing…"
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
            <p className="mt-0.5 text-xs text-zinc-500">{message.length}/{MESSAGE_MAX}</p>
          </div>

          <div className="border-t border-zinc-200 pt-3 space-y-3">
            <p className="text-sm font-medium text-zinc-700">About you (helps us match you)</p>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2">
                <span className="text-sm text-zinc-600">Pets?</span>
                <select
                  value={hasPets === "" ? "" : hasPets ? "yes" : "no"}
                  onChange={(e) => setHasPets(e.target.value === "" ? "" : e.target.value === "yes")}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900"
                >
                  <option value="">—</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <label className="inline-flex items-center gap-2">
                <span className="text-sm text-zinc-600">Children?</span>
                <select
                  value={hasChildren === "" ? "" : hasChildren ? "yes" : "no"}
                  onChange={(e) => setHasChildren(e.target.value === "" ? "" : e.target.value === "yes")}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900"
                >
                  <option value="">—</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              <label className="inline-flex items-center gap-2">
                <span className="text-sm text-zinc-600">Smoker?</span>
                <select
                  value={smoker === "" ? "" : smoker ? "yes" : "no"}
                  onChange={(e) => setSmoker(e.target.value === "" ? "" : e.target.value === "yes")}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900"
                >
                  <option value="">—</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            </div>
            {hasPets === true && (
              <div>
                <label htmlFor="enquiry-petDetails" className="block text-sm font-medium text-zinc-700">
                  Pet details (optional)
                </label>
                <input
                  id="enquiry-petDetails"
                  type="text"
                  value={petDetails}
                  onChange={(e) => setPetDetails(e.target.value)}
                  placeholder="e.g. 1 small dog"
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
            )}
            <div>
              <label htmlFor="enquiry-employment" className="block text-sm font-medium text-zinc-700">
                Employment status (optional)
              </label>
              <select
                id="enquiry-employment"
                value={employmentStatus}
                onChange={(e) => setEmploymentStatus(e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              >
                <option value="">—</option>
                {EMPLOYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {EMPLOYMENT_LABELS[s] ?? s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="enquiry-occupants" className="block text-sm font-medium text-zinc-700">
                Number of occupants (optional)
              </label>
              <input
                id="enquiry-occupants"
                type="number"
                min={1}
                value={intendedOccupants}
                onChange={(e) => setIntendedOccupants(e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label htmlFor="enquiry-income" className="block text-sm font-medium text-zinc-700">
                Income / affordability note (optional)
              </label>
              <input
                id="enquiry-income"
                type="text"
                value={incomeNotes}
                onChange={(e) => setIncomeNotes(e.target.value)}
                placeholder="e.g. Combined household income band"
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Send enquiry"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
