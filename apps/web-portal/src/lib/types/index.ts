/**
 * Shared types for the web portal (listings, users, tickets, etc.).
 * Will be used across components and data layer.
 */

export type { Role, Permission } from "./roles";
export { ALL_PERMISSIONS, DEFAULT_PERMISSIONS_BY_ROLE } from "./roles";

export type {
  UserProfile,
  UserProfileStatus,
  FirestoreTimestamp,
} from "./userProfile";
