import type { Role, Permission } from "./roles";

/**
 * Firestore Timestamp placeholder. Replace with firebase/firestore Timestamp when SDK is wired.
 */
export type FirestoreTimestamp = { seconds: number; nanoseconds: number };

export type UserProfileStatus = "active" | "invited" | "disabled";

export interface UserProfile {
  uid: string;
  email: string;
  role: Role;
  permissions: Permission[];
  agencyId: string | null;
  status: UserProfileStatus;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
