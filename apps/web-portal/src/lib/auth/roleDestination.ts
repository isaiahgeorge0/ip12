/**
 * Single source of truth for post-sign-in and layout redirect destinations by role.
 * Use for: sign-in redirect, admin layout assertRole, landlord layout assertRole.
 * Prevents bounce between /admin and /landlord for public/other roles.
 */

export type Role = string;

/**
 * Default destination for a given role when no safe returnTo is present.
 * - public, lead -> /portal
 * - landlord -> /landlord
 * - superAdmin, admin, agent -> /admin
 * - other (tenant, contractor, etc.) -> /properties
 */
export function getDefaultDestinationForRole(role: Role): string {
  switch (role) {
    case "public":
    case "lead":
      return "/portal";
    case "landlord":
      return "/landlord";
    case "superAdmin":
    case "admin":
    case "agent":
      return "/admin";
    default:
      return "/properties";
  }
}
