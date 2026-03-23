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
import {
  normalizedDisplayAddress,
  safeRentPcm,
} from "@/lib/admin/normalizePropertyDisplay";
import { ENQUIRY_STATUSES, ENQUIRY_STATUS_LABELS, type EnquiryStatus } from "@/lib/types/enquiry";
import { VIEWING_STATUSES, VIEWING_STATUS_LABELS, type ViewingStatus } from "@/lib/types/viewing";
import { AdminCreateTicketModal } from "@/components/admin/AdminCreateTicketModal";
import { AdminCreateOfferModal } from "@/components/admin/AdminCreateOfferModal";
import { AdminProgressJourney, getJourneyStageFromData } from "@/components/admin/AdminProgressJourney";
import { AdminNextActionCard } from "@/components/admin/AdminNextActionCard";
import { AdminMatchScoreBadge } from "@/components/admin/AdminMatchScoreBadge";
import { getNextAction, getFurthestPipelineStage } from "@/lib/workflow/getNextAction";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";
import { HistoryBackLink } from "@/components/HistoryBackLink";
import { OFFER_STATUS_LABELS, type OfferStatus } from "@/lib/types/offer";

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
  landlordExternalId?: string;
  createdAt: unknown;
  status: string;
  email: string;
  displayName: string;
  phone?: string;
  externalId?: string;
  userFound?: boolean;
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

  type EnquiryRow = {
    id: string;
    propertyId: string;
    agencyId: string;
    applicantName: string;
    applicantEmail: string;
    applicantPhone: string | null;
    message: string;
    moveInDate?: string | null;
    hasPets?: boolean | null;
    petDetails?: string | null;
    hasChildren?: boolean | null;
    employmentStatus?: string | null;
    smoker?: boolean | null;
    intendedOccupants?: number | null;
    status: EnquiryStatus;
    internalNotes: string | null;
    statusUpdatedAt: number | null;
    statusUpdatedBy: string | null;
    createdAt: unknown;
  };
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([]);
  const [loadingEnquiries, setLoadingEnquiries] = useState(false);
  const [enquiryUpdatingId, setEnquiryUpdatingId] = useState<string | null>(null);
  const [enquiryModal, setEnquiryModal] = useState<EnquiryRow | null>(null);
  const [enquiryModalNotes, setEnquiryModalNotes] = useState("");
  const [enquiryModalStatus, setEnquiryModalStatus] = useState<EnquiryStatus>("new");
  const [enquiryModalSaving, setEnquiryModalSaving] = useState(false);

  type ViewingRow = {
    id: string;
    propertyId: string;
    agencyId: string;
    applicantUserId: string | null;
    applicantName: string;
    applicantEmail: string;
    applicantPhone: string | null;
    scheduledAt: number | null;
    status: ViewingStatus;
    notes: string | null;
    source: string;
  };
  const [viewings, setViewings] = useState<ViewingRow[]>([]);
  const [loadingViewings, setLoadingViewings] = useState(false);
  const [viewingUpdatingId, setViewingUpdatingId] = useState<string | null>(null);
  const [bookViewingOpen, setBookViewingOpen] = useState(false);
  const [bookViewingSubmitting, setBookViewingSubmitting] = useState(false);
  const [proceedPromptViewingId, setProceedPromptViewingId] = useState<string | null>(null);
  const [createAppViewingId, setCreateAppViewingId] = useState<string | null>(null);
  const [bookViewingForm, setBookViewingForm] = useState({
    enquiryId: "",
    applicantName: "",
    applicantEmail: "",
    applicantPhone: "",
    scheduledAt: "",
    notes: "",
  });
  const [pipelineItems, setPipelineItems] = useState<{ id: string; applicantName: string; stage: string }[]>([]);
  const [loadingPipeline, setLoadingPipeline] = useState(false);
  type OfferRow = { id: string; propertyId: string; propertyDisplayLabel: string; agencyId: string; applicantId: string | null; applicantName: string | null; applicantEmail: string | null; amount: number; status: OfferStatus; source: string; updatedAt: string | null };
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [createOfferOpen, setCreateOfferOpen] = useState(false);
  const [hasTenancyForProperty, setHasTenancyForProperty] = useState(false);
  const [applicantMatches, setApplicantMatches] = useState<{
    applicantId: string;
    applicantName: string;
    applicantEmail: string;
    applicantPhone: string | null;
    score: number;
    reasons: string[];
    warnings: string[];
    matched: boolean;
  }[]>([]);
  const [loadingApplicantMatches, setLoadingApplicantMatches] = useState(false);

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
    // Prefer API when we have agencyId (from URL or session); same canonical path as list.
    if ((queryAgencyId || queryLandlordUid) && effectiveAgencyId) {
      const q = new URLSearchParams();
      q.set("agencyId", effectiveAgencyId);
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
        .then((data: { id: string; displayAddress?: unknown; postcode?: string; type?: string; bedrooms?: number; bathrooms?: number; rentPcm?: unknown; status?: string; archived?: boolean; createdAtMs?: number | null; updatedAtMs?: number | null; createdByUid?: string } | null) => {
          if (!data) return;
          const displayAddr =
            typeof data.displayAddress === "string" && data.displayAddress.trim()
              ? data.displayAddress.trim()
              : "Untitled property";
          const p: Property = {
            id: data.id,
            displayAddress: displayAddr,
            postcode: typeof data.postcode === "string" ? data.postcode : "",
            type: ((typeof data.type === "string" ? data.type : "House") ?? "House") as PropertyType,
            bedrooms: Number(data.bedrooms) ?? 0,
            bathrooms: Number(data.bathrooms) ?? 0,
            rentPcm: safeRentPcm(data.rentPcm),
            status: ((typeof data.status === "string" ? data.status : "Available") ?? "Available") as PropertyStatus,
            archived: data.archived === true,
            createdAt: data.createdAtMs ?? null,
            updatedAt: data.updatedAtMs ?? null,
            createdByUid: typeof data.createdByUid === "string" ? data.createdByUid : "",
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
    // Canonical path: agencies/{agencyId}/properties/{propertyId}; propertyId = Firestore doc id.
    const ref = doc(db, propertiesCol(effectiveAgencyId), propertyId);
    getDoc(ref).then((snap) => {
      setLoading(false);
      if (!snap.exists()) {
        setNotFound(true);
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      const p: Property = {
        id: snap.id,
        displayAddress: normalizedDisplayAddress(data, snap.id),
        postcode: typeof data.postcode === "string" ? data.postcode : "",
        type: (typeof data.type === "string" ? data.type : "House") as PropertyType,
        bedrooms: Number(data.bedrooms) ?? 0,
        bathrooms: Number(data.bathrooms) ?? 0,
        rentPcm: safeRentPcm(data.rentPcm),
        status: (typeof data.status === "string" ? data.status : "Available") as PropertyStatus,
        archived: data.archived === true,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdByUid: typeof data.createdByUid === "string" ? data.createdByUid : "",
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
      .catch((err) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[PropertyDetail] failed to load landlord assignments", err);
        }
        setAssignments([]);
      })
      .finally(() => setLoadingAssignments(false));
  }, [propertyId, effectiveAgencyId, queryLandlordUid]);

  useEffect(() => {
    if (!propertyId) return;
    fetchAssignments();
  }, [propertyId, fetchAssignments]);

  useEffect(() => {
    if (!propertyId || !effectiveAgencyId) {
      setEnquiries([]);
      return;
    }
    setLoadingEnquiries(true);
    const q = `?agencyId=${encodeURIComponent(effectiveAgencyId)}${queryLandlordUid ? `&landlordUid=${encodeURIComponent(queryLandlordUid)}` : ""}`;
    fetch(`/api/admin/properties/${propertyId}/enquiries${q}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: EnquiryRow[]) => setEnquiries(Array.isArray(data) ? data : []))
      .catch(() => setEnquiries([]))
      .finally(() => setLoadingEnquiries(false));
  }, [propertyId, effectiveAgencyId, queryLandlordUid]);

  const refetchEnquiries = useCallback(() => {
    if (!propertyId || !effectiveAgencyId) return;
    const q = `?agencyId=${encodeURIComponent(effectiveAgencyId)}${queryLandlordUid ? `&landlordUid=${encodeURIComponent(queryLandlordUid)}` : ""}`;
    fetch(`/api/admin/properties/${propertyId}/enquiries${q}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: EnquiryRow[]) => setEnquiries(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [propertyId, effectiveAgencyId, queryLandlordUid]);

  const handleEnquiryStatusChange = useCallback(
    (enquiryId: string, newStatus: EnquiryStatus) => {
      if (!effectiveAgencyId) return;
      setEnquiryUpdatingId(enquiryId);
      fetch(`/api/admin/enquiries/${enquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agencyId: effectiveAgencyId, status: newStatus }),
      })
        .then((res) => {
          if (res.ok) refetchEnquiries();
          else setToast("Failed to update status");
        })
        .catch(() => setToast("Failed to update status"))
        .finally(() => setEnquiryUpdatingId(null));
    },
    [effectiveAgencyId, refetchEnquiries]
  );

  const handleEnquiryModalSave = useCallback(() => {
    const row = enquiryModal;
    if (!row || !effectiveAgencyId) return;
    setEnquiryModalSaving(true);
    fetch(`/api/admin/enquiries/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        agencyId: effectiveAgencyId,
        status: enquiryModalStatus,
        internalNotes: enquiryModalNotes.trim() || null,
      }),
    })
      .then((res) => {
        if (res.ok) {
          refetchEnquiries();
          setEnquiryModal(null);
          setToast("Enquiry updated");
        } else {
          setToast("Failed to update");
        }
      })
      .catch(() => setToast("Failed to update"))
      .finally(() => setEnquiryModalSaving(false));
  }, [enquiryModal, enquiryModalNotes, enquiryModalStatus, effectiveAgencyId, refetchEnquiries]);

  useEffect(() => {
    if (!propertyId || !effectiveAgencyId) {
      setViewings([]);
      return;
    }
    setLoadingViewings(true);
    fetch(
      `/api/admin/viewings?agencyId=${encodeURIComponent(effectiveAgencyId)}&propertyId=${encodeURIComponent(propertyId)}&limit=50`,
      { credentials: "include" }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ViewingRow[]) => setViewings(Array.isArray(data) ? data : []))
      .catch(() => setViewings([]))
      .finally(() => setLoadingViewings(false));
  }, [propertyId, effectiveAgencyId]);

  const refetchViewings = useCallback(() => {
    if (!propertyId || !effectiveAgencyId) return;
    fetch(
      `/api/admin/viewings?agencyId=${encodeURIComponent(effectiveAgencyId)}&propertyId=${encodeURIComponent(propertyId)}&limit=50`,
      { credentials: "include" }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ViewingRow[]) => setViewings(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [propertyId, effectiveAgencyId]);

  useEffect(() => {
    if (!effectiveAgencyId || !propertyId) {
      setPipelineItems([]);
      return;
    }
    setLoadingPipeline(true);
    fetch(
      `/api/admin/application-pipeline?agencyId=${encodeURIComponent(effectiveAgencyId)}&propertyId=${encodeURIComponent(propertyId)}&limit=20`,
      { credentials: "include" }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { id: string; applicantName?: string; stage?: string }[]) =>
        setPipelineItems(
          Array.isArray(data)
            ? data.map((r) => ({
                id: r.id,
                applicantName: r.applicantName ?? "",
                stage: r.stage ?? "",
              }))
            : []
        )
      )
      .catch(() => setPipelineItems([]))
      .finally(() => setLoadingPipeline(false));
  }, [effectiveAgencyId, propertyId]);

  const refetchPipeline = useCallback(() => {
    if (!effectiveAgencyId || !propertyId) return;
    fetch(
      `/api/admin/application-pipeline?agencyId=${encodeURIComponent(effectiveAgencyId)}&propertyId=${encodeURIComponent(propertyId)}&limit=20`,
      { credentials: "include" }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { id: string; applicantName?: string; stage?: string }[]) =>
        setPipelineItems(
          Array.isArray(data)
            ? data.map((r) => ({
                id: r.id,
                applicantName: r.applicantName ?? "",
                stage: r.stage ?? "",
              }))
            : []
        )
      )
      .catch(() => {});
  }, [effectiveAgencyId, propertyId]);

  useEffect(() => {
    if (!effectiveAgencyId || !propertyId) {
      setOffers([]);
      return;
    }
    setLoadingOffers(true);
    fetch(
      `/api/admin/offers?agencyId=${encodeURIComponent(effectiveAgencyId)}&propertyId=${encodeURIComponent(propertyId)}`,
      { credentials: "include" }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((data: OfferRow[]) => setOffers(Array.isArray(data) ? data : []))
      .catch(() => setOffers([]))
      .finally(() => setLoadingOffers(false));
  }, [effectiveAgencyId, propertyId]);

  const refetchOffers = useCallback(() => {
    if (!effectiveAgencyId || !propertyId) return;
    fetch(
      `/api/admin/offers?agencyId=${encodeURIComponent(effectiveAgencyId)}&propertyId=${encodeURIComponent(propertyId)}`,
      { credentials: "include" }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((data: OfferRow[]) => setOffers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [effectiveAgencyId, propertyId]);

  useEffect(() => {
    if (!effectiveAgencyId || !propertyId) {
      setHasTenancyForProperty(false);
      setApplicantMatches([]);
      return;
    }
    // TODO(legacy-tenancy-pass): switch to a property-scoped tenancy read endpoint
    // (e.g. /api/admin/properties/[propertyId]/tenancies) to avoid fetching full tenancy list.
    fetch(`/api/admin/tenancies?agencyId=${encodeURIComponent(effectiveAgencyId)}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((list: { propertyId?: string }[]) => {
        setHasTenancyForProperty(Array.isArray(list) && list.some((t) => t.propertyId === propertyId));
      })
      .catch(() => setHasTenancyForProperty(false));

    const params = new URLSearchParams();
    params.set("agencyId", effectiveAgencyId);
    params.set("limit", "20");
    setLoadingApplicantMatches(true);
    fetch(
      `/api/admin/properties/${encodeURIComponent(propertyId)}/matches?${params.toString()}`,
      { credentials: "include" }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setApplicantMatches(Array.isArray(data) ? data : []))
      .catch(() => setApplicantMatches([]))
      .finally(() => setLoadingApplicantMatches(false));
  }, [effectiveAgencyId, propertyId]);

  const handleViewingStatusChange = useCallback(
    (viewingId: string, newStatus: ViewingStatus) => {
      if (!effectiveAgencyId) return;
      setViewingUpdatingId(viewingId);
      fetch(`/api/admin/viewings/${viewingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agencyId: effectiveAgencyId, status: newStatus }),
      })
        .then((res) => {
          if (res.ok) refetchViewings();
          else setToast("Failed to update status");
        })
        .catch(() => setToast("Failed to update status"))
        .finally(() => setViewingUpdatingId(null));
    },
    [effectiveAgencyId, refetchViewings]
  );

  const handleBookViewingSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!effectiveAgencyId || !propertyId) return;
      const scheduledAt = bookViewingForm.scheduledAt.trim();
      if (!scheduledAt) {
        setToast("Date & time required");
        return;
      }
      const payload: Record<string, unknown> = {
        agencyId: effectiveAgencyId,
        propertyId,
        scheduledAt: new Date(scheduledAt).getTime(),
        applicantName: bookViewingForm.applicantName.trim() || undefined,
        applicantEmail: bookViewingForm.applicantEmail.trim() || undefined,
        applicantPhone: bookViewingForm.applicantPhone.trim() || undefined,
        notes: bookViewingForm.notes.trim() || undefined,
      };
      if (bookViewingForm.enquiryId) {
        payload.enquiryId = bookViewingForm.enquiryId;
      }
      setBookViewingSubmitting(true);
      fetch("/api/admin/viewings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
        .then((res) => {
          if (res.ok) {
            refetchViewings();
            setBookViewingOpen(false);
            setBookViewingForm({ enquiryId: "", applicantName: "", applicantEmail: "", applicantPhone: "", scheduledAt: "", notes: "" });
            setToast("Viewing booked");
          } else {
            return res.json().then((d: { error?: string }) => setToast(d?.error ?? "Failed to book"));
          }
        })
        .catch(() => setToast("Failed to book"))
        .finally(() => setBookViewingSubmitting(false));
    },
    [effectiveAgencyId, propertyId, bookViewingForm, refetchViewings]
  );

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
        <HistoryBackLink
          href="/admin/properties"
          className="mt-2 inline-block text-sm font-medium text-zinc-600 hover:underline"
        >
          ← Back to properties
        </HistoryBackLink>
      </>
    );
  }

  if (forbidden) {
    return (
      <>
        <PageHeader title="Property" />
        <p className="text-sm text-zinc-500">You don&apos;t have access to this property.</p>
        <HistoryBackLink
          href="/admin/landlords"
          className="mt-2 inline-block text-sm font-medium text-zinc-600 hover:underline"
        >
          ← Back to Landlords
        </HistoryBackLink>
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

      {enquiryModal && !isReadOnlyCrossAgency && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="enquiry-modal-title"
        >
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 id="enquiry-modal-title" className="text-lg font-semibold text-zinc-900">
              Enquiry: {enquiryModal.applicantName || "Applicant"}
            </h2>
            <p className="text-sm text-zinc-500 mt-0.5">{enquiryModal.applicantEmail}</p>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="enquiry-modal-status" className="block text-sm font-medium text-zinc-700">
                  Status
                </label>
                <select
                  id="enquiry-modal-status"
                  value={enquiryModalStatus}
                  onChange={(e) => setEnquiryModalStatus(e.target.value as EnquiryStatus)}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                >
                  {ENQUIRY_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {ENQUIRY_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="enquiry-modal-notes" className="block text-sm font-medium text-zinc-700">
                  Internal notes
                </label>
                <textarea
                  id="enquiry-modal-notes"
                  rows={4}
                  value={enquiryModalNotes}
                  onChange={(e) => setEnquiryModalNotes(e.target.value)}
                  placeholder="Private notes (not visible to applicant)"
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button
                type="button"
                onClick={() => setEnquiryModal(null)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEnquiryModalSave}
                disabled={enquiryModalSaving}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {enquiryModalSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </Card>
        </div>
      )}

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
            <HistoryBackLink
              href="/admin/properties"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              ← Back
            </HistoryBackLink>
          </div>
        }
      />

      {isReadOnlyCrossAgency && (
        <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800">
          Read-only (cross-agency). You can view this property but cannot edit or change landlord assignments.
        </div>
      )}

      {!editing && propertyId && (
        <>
          <AdminNextActionCard
            action={getNextAction({
              enquiry: enquiries.length > 0,
              viewing: viewings.length > 0,
              viewingCompleted: viewings.some((v) => v.status === "completed"),
              pipelineStage: getFurthestPipelineStage(pipelineItems.map((p) => p.stage)),
              offer: offers.length > 0,
              offerAccepted: offers.some((o) => o.status === "accepted"),
              tenancy: hasTenancyForProperty,
            })}
          />
          <AdminProgressJourney
            currentStage={getJourneyStageFromData({
              hasViewing: viewings.length > 0,
              hasPipelineEntry: pipelineItems.length > 0,
              hasOffer: offers.length > 0,
              hasAcceptedOffer: offers.some((o) => o.status === "accepted"),
              hasTenancy: hasTenancyForProperty,
            })}
            className="mb-6"
          />
        </>
      )}

      {!editing && (
        <Card className="p-6 mb-6">
          <h2 className="text-base font-medium text-zinc-900 mb-0.5">Recommended applicants</h2>
          <p className="text-xs text-zinc-500 mb-3">
            Rule-based matches using applicants&apos; preferences (budget, bedrooms, areas, type).
          </p>
          {loadingApplicantMatches ? (
            <p className="text-sm text-zinc-500">Loading recommended applicants…</p>
          ) : applicantMatches.filter((m) => m.matched).length === 0 ? (
            <p className="text-sm text-zinc-500">
              No strong applicant matches yet. As more applicant preferences are added, matches will appear here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Applicant</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Score</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Reasons</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Warnings</th>
                    <th className="text-left py-2 font-medium text-zinc-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applicantMatches
                    .filter((m) => m.matched)
                    .slice(0, 10)
                    .map((m) => (
                      <tr key={m.applicantId} className="border-b border-zinc-100 align-top">
                        <td className="py-2 pr-4 text-zinc-900">
                          <Link
                            href={`/admin/applicants/${m.applicantId}`}
                            className="text-zinc-700 hover:underline"
                          >
                            {m.applicantName || "—"}
                          </Link>
                          <span className="block text-xs text-zinc-500">
                            {m.applicantEmail || "—"}
                            {m.applicantPhone ? ` · ${m.applicantPhone}` : ""}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <AdminMatchScoreBadge score={m.score} />
                        </td>
                        <td className="py-2 pr-4 text-zinc-600">
                          {(m.reasons ?? []).slice(0, 3).join(" · ") || "—"}
                        </td>
                        <td className="py-2 pr-4 text-zinc-600">
                          {(m.warnings ?? []).length > 0 ? (
                            <span className="text-amber-800">
                              ⚠ {m.warnings.slice(0, 2).join(" · ")}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/admin/applicants/${m.applicantId}`}
                              className="text-zinc-600 hover:underline text-xs"
                            >
                              View applicant
                            </Link>
                            {!isReadOnlyCrossAgency && (
                              <button
                                type="button"
                                onClick={() => {
                                  setBookViewingForm((prev) => ({
                                    ...prev,
                                    enquiryId: "",
                                    applicantName: m.applicantName || "",
                                    applicantEmail: m.applicantEmail || "",
                                    applicantPhone: m.applicantPhone || "",
                                  }));
                                  setBookViewingOpen(true);
                                }}
                                className="text-zinc-600 hover:underline text-xs"
                              >
                                Book viewing
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
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
              {typeof property.rentPcm === "number" && Number.isFinite(property.rentPcm) ? `£${property.rentPcm}` : "—"}
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
                const resolvedExternalId = (a.externalId && a.externalId.trim()) || (a.landlordExternalId && a.landlordExternalId.trim()) || null;
                const title =
                  (a.displayName && a.displayName.trim()) ||
                  (resolvedExternalId ? `Legacy landlord ${resolvedExternalId}` : a.email || a.landlordUid);
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded border border-zinc-200 bg-zinc-50/50 px-3 py-2"
                  >
                    <div className="text-sm text-zinc-900">
                      <p className="font-medium">{title}</p>
                      <p className="text-xs text-zinc-600">
                        {a.email ? a.email : "No email"}{" · "}
                        {a.phone && a.phone.trim() ? a.phone : "No phone"}
                        {resolvedExternalId ? ` · External ID: ${resolvedExternalId}` : ""}
                      </p>
                    </div>
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

      {!editing && (
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-medium text-zinc-900 mb-0.5">1. Enquiries</h2>
          <p className="text-xs text-zinc-500 mb-3">Leads from the listing. Update status and add notes; convert to applicant when ready.</p>
          {loadingEnquiries ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : enquiries.length === 0 ? (
            <p className="text-sm text-zinc-500">No enquiries for this property yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Name</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Email</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Phone</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Move-in</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">When</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Status</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Notes</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Summary</th>
                    <th className="text-left py-2 font-medium text-zinc-700">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {enquiries.map((e) => {
                    const parts: string[] = [];
                    if (e.hasPets === true) parts.push(e.petDetails ? `Pets: ${e.petDetails}` : "Pets");
                    if (e.hasChildren === true) parts.push("Children");
                    if (e.employmentStatus) parts.push(e.employmentStatus.replace("_", " "));
                    if (e.smoker === true) parts.push("Smoker");
                    if (e.intendedOccupants != null) parts.push(`${e.intendedOccupants} occupants`);
                    const summary = parts.length ? parts.join(" · ") : "—";
                    const isUpdating = enquiryUpdatingId === e.id;
                    return (
                      <tr key={e.id} className="border-b border-zinc-100">
                        <td className="py-2 pr-4 text-zinc-900">{e.applicantName || "—"}</td>
                        <td className="py-2 pr-4 text-zinc-600">{e.applicantEmail || "—"}</td>
                        <td className="py-2 pr-4 text-zinc-600">{e.applicantPhone || "—"}</td>
                        <td className="py-2 pr-4 text-zinc-600">
                          {e.moveInDate ? new Date(e.moveInDate).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-2 pr-4 text-zinc-600">
                          {typeof e.createdAt === "number"
                            ? new Date(e.createdAt).toLocaleString()
                            : formatPropertyDate(e.createdAt)}
                        </td>
                        <td className="py-2 pr-4">
                          {!isReadOnlyCrossAgency ? (
                            <select
                              value={e.status}
                              onChange={(ev) => handleEnquiryStatusChange(e.id, ev.target.value as EnquiryStatus)}
                              disabled={isUpdating}
                              className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium bg-zinc-50 text-zinc-900 disabled:opacity-50"
                            >
                              {ENQUIRY_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {ENQUIRY_STATUS_LABELS[s]}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <AdminStatusBadge variant={getStatusBadgeVariant(e.status, "enquiry")}>
                              {ENQUIRY_STATUS_LABELS[e.status] ?? e.status}
                            </AdminStatusBadge>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-zinc-600 max-w-[140px] truncate" title={e.internalNotes ?? undefined}>
                          {e.internalNotes ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEnquiryModal(e);
                                setEnquiryModalNotes(e.internalNotes ?? "");
                                setEnquiryModalStatus(e.status);
                              }}
                              className="text-left text-zinc-600 hover:underline truncate block max-w-[140px]"
                            >
                              {e.internalNotes.slice(0, 40)}{e.internalNotes.length > 40 ? "…" : ""}
                            </button>
                          ) : (
                            !isReadOnlyCrossAgency ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEnquiryModal(e);
                                  setEnquiryModalNotes("");
                                  setEnquiryModalStatus(e.status);
                                }}
                                className="text-zinc-400 hover:text-zinc-600 text-xs"
                              >
                                Add notes
                              </button>
                            ) : (
                              "—"
                            )
                          )}
                        </td>
                        <td className="py-2 pr-4 text-zinc-600 max-w-[180px] truncate" title={summary}>
                          {summary}
                        </td>
                        <td className="py-2 text-zinc-600 max-w-xs truncate" title={e.message}>
                          {e.message || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {!editing && (
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-medium text-zinc-900 mb-0.5 flex items-center justify-between gap-2">
            <span>2. Viewings</span>
            {!isReadOnlyCrossAgency && (
              <button
                type="button"
                onClick={() => setBookViewingOpen(true)}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Book viewing
              </button>
            )}
          </h2>
          <p className="text-xs text-zinc-500 mb-3">Scheduled viewings. After completion, send proceed prompt or create application.</p>
          {loadingViewings ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : viewings.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-500">No viewings for this property yet.</p>
              {!isReadOnlyCrossAgency && (
                <button
                  type="button"
                  onClick={() => setBookViewingOpen(true)}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Book viewing
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Applicant</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Date / time</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Status</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Notes</th>
                    {!isReadOnlyCrossAgency && (
                      <th className="text-left py-2 font-medium text-zinc-700">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {viewings.map((v) => {
                    const isUpdating = viewingUpdatingId === v.id;
                    const isCompleted = v.status === "completed";
                    const sendingProceed = proceedPromptViewingId === v.id;
                    const creatingApp = createAppViewingId === v.id;
                    return (
                      <tr key={v.id} className="border-b border-zinc-100">
                        <td className="py-2 pr-4 text-zinc-900">
                          {v.applicantName || "—"}
                          {v.applicantEmail && (
                            <span className="block text-xs text-zinc-500">{v.applicantEmail}</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-zinc-600">
                          {v.scheduledAt != null ? new Date(v.scheduledAt).toLocaleString() : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {!isReadOnlyCrossAgency ? (
                            <select
                              value={v.status}
                              onChange={(ev) => handleViewingStatusChange(v.id, ev.target.value as ViewingStatus)}
                              disabled={isUpdating}
                              className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium bg-zinc-50 text-zinc-900 disabled:opacity-50"
                            >
                              {VIEWING_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {VIEWING_STATUS_LABELS[s]}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <AdminStatusBadge variant={getStatusBadgeVariant(v.status, "viewing")}>
                              {VIEWING_STATUS_LABELS[v.status] ?? v.status}
                            </AdminStatusBadge>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-zinc-600 max-w-[180px] truncate" title={v.notes ?? undefined}>
                          {v.notes ? `${v.notes.slice(0, 50)}${v.notes.length > 50 ? "…" : ""}` : "—"}
                        </td>
                        {!isReadOnlyCrossAgency && (
                          <td className="py-2">
                            {isCompleted && (
                              <div className="flex flex-wrap gap-1 items-center">
                                {v.applicantUserId ? (
                                  <button
                                    type="button"
                                    disabled={sendingProceed}
                                    onClick={() => {
                                      setProceedPromptViewingId(v.id);
                                      fetch(`/api/admin/viewings/${v.id}/send-proceed-prompt`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        credentials: "include",
                                        body: JSON.stringify({ agencyId: effectiveAgencyId }),
                                      })
                                        .then((res) => {
                                          if (res.ok) {
                                            setToast("Proceed prompt sent");
                                            refetchPipeline();
                                          } else {
                                            res.json().then((d: { error?: string }) => setToast(d?.error ?? "Failed"));
                                          }
                                        })
                                        .catch(() => setToast("Failed"))
                                        .finally(() => setProceedPromptViewingId(null));
                                    }}
                                    className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                                  >
                                    {sendingProceed ? "Sending…" : "Send proceed prompt"}
                                  </button>
                                ) : (
                                  <span
                                    className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 bg-zinc-50 cursor-not-allowed"
                                    title="Proceed prompt is only available for applicants with a portal account."
                                  >
                                    Send proceed prompt
                                  </span>
                                )}
                                <button
                                  type="button"
                                  disabled={creatingApp}
                                  onClick={() => {
                                    setCreateAppViewingId(v.id);
                                    fetch(`/api/admin/viewings/${v.id}/create-application`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      credentials: "include",
                                      body: JSON.stringify({ agencyId: effectiveAgencyId }),
                                    })
                                      .then(async (res) => {
                                        const data = await res.json().catch(() => ({}));
                                        if (res.ok && data.applicantId) {
                                          setToast(data.linked ? "Linked to existing applicant" : "Application created");
                                          refetchViewings();
                                          refetchPipeline();
                                        } else {
                                          setToast(data?.error ?? "Failed");
                                        }
                                      })
                                      .catch(() => setToast("Failed"))
                                      .finally(() => setCreateAppViewingId(null));
                                  }}
                                  className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                                >
                                  {creatingApp ? "Creating…" : "Create application"}
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {!editing && (pipelineItems.length > 0 || loadingPipeline) && propertyId && effectiveAgencyId && (
        <Card className="p-6 mt-6">
          <h2 className="text-base font-medium text-zinc-900 mb-0.5 flex items-center justify-between gap-2">
            <span>3. Application pipeline</span>
            <Link
              href={`/admin/application-pipeline?agencyId=${encodeURIComponent(effectiveAgencyId)}&propertyId=${encodeURIComponent(propertyId)}`}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              View all →
            </Link>
          </h2>
          <p className="text-xs text-zinc-500 mb-3">Applicant progress for this property. Move stages in the pipeline or complete via action queue.</p>
          {loadingPipeline ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : pipelineItems.length === 0 ? null : (
            <ul className="text-sm text-zinc-700 space-y-1">
              {pipelineItems.slice(0, 5).map((p) => (
                <li key={p.id}>
                  {p.applicantName || "—"} — {p.stage}
                </li>
              ))}
              {pipelineItems.length > 5 && (
                <li>
                  <Link
                    href={`/admin/application-pipeline?agencyId=${encodeURIComponent(effectiveAgencyId)}&propertyId=${encodeURIComponent(propertyId)}`}
                    className="text-zinc-600 hover:underline"
                  >
                    +{pipelineItems.length - 5} more…
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Card>
      )}

      {!editing && propertyId && effectiveAgencyId && (
        <Card className="p-6 mt-6">
          <h2 className="text-base font-medium text-zinc-900 mb-0.5 flex items-center justify-between gap-2">
            <span>4. Offers</span>
            {!isReadOnlyCrossAgency && (
              <button
                type="button"
                onClick={() => setCreateOfferOpen(true)}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Create offer
              </button>
            )}
          </h2>
          <p className="text-xs text-zinc-500 mb-3">Offers for this property. When applicant accepts, the item appears in the action queue.</p>
          {loadingOffers ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : offers.length === 0 ? (
            <p className="text-sm text-zinc-500">No offers for this property yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Applicant</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Amount</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Status</th>
                    <th className="text-left py-2 font-medium text-zinc-700">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o) => (
                    <tr key={o.id} className="border-b border-zinc-100">
                      <td className="py-2 pr-4 text-zinc-900">
                        {o.applicantId ? (
                          <Link
                            href={`/admin/applicants/${o.applicantId}`}
                            className="text-zinc-700 hover:underline"
                          >
                            {o.applicantName || "—"}
                          </Link>
                        ) : (
                          <span>{o.applicantName || "—"}</span>
                        )}
                        {o.applicantEmail && (
                          <span className="block text-xs text-zinc-500">{o.applicantEmail}</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-zinc-900">£{typeof o.amount === "number" ? o.amount.toLocaleString() : "0"}</td>
                      <td className="py-2 pr-4">
                        <AdminStatusBadge variant={getStatusBadgeVariant(o.status, "offer")}>
                          {OFFER_STATUS_LABELS[o.status] ?? o.status}
                        </AdminStatusBadge>
                      </td>
                      <td className="py-2 text-zinc-600">
                        {o.updatedAt ? new Date(o.updatedAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {createOfferOpen && property && effectiveAgencyId && !isReadOnlyCrossAgency && (
        <AdminCreateOfferModal
          open={createOfferOpen}
          onClose={() => setCreateOfferOpen(false)}
          agencyId={effectiveAgencyId}
          initialProperty={{
            agencyId: effectiveAgencyId,
            propertyId: property.id,
            displayAddress: property.displayAddress,
          }}
          onSuccess={() => {
            setToast("Offer created");
            refetchOffers();
            setCreateOfferOpen(false);
          }}
        />
      )}

      {bookViewingOpen && !isReadOnlyCrossAgency && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="book-viewing-title"
        >
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 id="book-viewing-title" className="text-lg font-semibold text-zinc-900">
              Book viewing
            </h2>
            <form onSubmit={handleBookViewingSubmit} className="mt-4 space-y-4">
              {enquiries.length > 0 && (
                <div>
                  <label htmlFor="book-viewing-enquiry" className="block text-sm font-medium text-zinc-700">
                    From enquiry (optional)
                  </label>
                  <select
                    id="book-viewing-enquiry"
                    value={bookViewingForm.enquiryId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setBookViewingForm((prev) => ({
                        ...prev,
                        enquiryId: id,
                        ...(id ? (() => {
                          const enq = enquiries.find((x) => x.id === id);
                          return enq
                            ? {
                                applicantName: enq.applicantName ?? "",
                                applicantEmail: enq.applicantEmail ?? "",
                                applicantPhone: enq.applicantPhone ?? "",
                              }
                            : {};
                        })() : {}),
                      }));
                    }}
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                  >
                    <option value="">Manual booking</option>
                    {enquiries.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.applicantName || e.applicantEmail || e.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="book-viewing-name" className="block text-sm font-medium text-zinc-700">
                  Applicant name
                </label>
                <input
                  id="book-viewing-name"
                  type="text"
                  value={bookViewingForm.applicantName}
                  onChange={(e) => setBookViewingForm((prev) => ({ ...prev, applicantName: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div>
                <label htmlFor="book-viewing-email" className="block text-sm font-medium text-zinc-700">
                  Applicant email
                </label>
                <input
                  id="book-viewing-email"
                  type="email"
                  value={bookViewingForm.applicantEmail}
                  onChange={(e) => setBookViewingForm((prev) => ({ ...prev, applicantEmail: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div>
                <label htmlFor="book-viewing-phone" className="block text-sm font-medium text-zinc-700">
                  Applicant phone (optional)
                </label>
                <input
                  id="book-viewing-phone"
                  type="tel"
                  value={bookViewingForm.applicantPhone}
                  onChange={(e) => setBookViewingForm((prev) => ({ ...prev, applicantPhone: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div>
                <label htmlFor="book-viewing-datetime" className="block text-sm font-medium text-zinc-700">
                  Date & time *
                </label>
                <input
                  id="book-viewing-datetime"
                  type="datetime-local"
                  required
                  value={bookViewingForm.scheduledAt}
                  onChange={(e) => setBookViewingForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div>
                <label htmlFor="book-viewing-notes" className="block text-sm font-medium text-zinc-700">
                  Notes (optional)
                </label>
                <textarea
                  id="book-viewing-notes"
                  rows={2}
                  value={bookViewingForm.notes}
                  onChange={(e) => setBookViewingForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setBookViewingOpen(false)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookViewingSubmitting}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {bookViewingSubmitting ? "Booking…" : "Book viewing"}
                </button>
              </div>
            </form>
          </Card>
        </div>
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
