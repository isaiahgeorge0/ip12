import type { Role, Permission } from "./roles";

/**
 * Firestore Timestamp placeholder. Replace with firebase/firestore Timestamp when SDK is wired.
 */
export type FirestoreTimestamp = { seconds: number; nanoseconds: number };

export type UserProfileStatus = "active" | "invited" | "pending" | "disabled";

export interface UserProfile {
  uid: string;
  email: string;
  role: Role;
  permissions: Permission[];
  /** Multi-agency: list of agency ids this user (e.g. landlord) belongs to. */
  agencyIds: string[];
  /** Convenience; defaults to first entry in agencyIds. */
  primaryAgencyId?: string | null;
  /** @deprecated Use agencyIds. Kept for migration: if agencyId exists, treat as agencyIds: [agencyId]. */
  agencyId?: string | null;
  status: UserProfileStatus;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  /** Optional; used e.g. in landlord portal. */
  displayName?: string;
  /** Optional; used e.g. for enquiry prefill and public profile. */
  phone?: string;
  /** Set when inviting a landlord; set status to "active" on first login. */
  invitedAt?: FirestoreTimestamp;
  invitedByUid?: string;
}
