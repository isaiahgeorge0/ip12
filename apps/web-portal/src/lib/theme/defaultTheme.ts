import type { ThemeTokens } from "@/lib/theme/tokens";

/**
 * Default admin theme tokens.
 *
 * IMPORTANT: these values intentionally match the current UI so introducing
 * tokens does not visually change the admin experience.
 */
export const defaultTheme: ThemeTokens = {
  background: "241 241 244", // zinc-100 (slightly deeper)
  surface: "255 255 255", // white
  surfaceMuted: "245 245 246", // subtle elevated-neutral
  border: "212 212 216", // stronger than zinc-200 for clearer separation
  foreground: "24 24 27", // zinc-900
  mutedForeground: "63 63 70", // zinc-700 for better readability
  // Accent (brand) - controlled, not overwhelming
  // Default: indigo-600-ish to feel modern/premium while staying subtle.
  // Accent: slightly deeper for stronger CTA presence.
  accent: "67 56 202", // indigo-700
  accentHover: "55 48 163", // indigo-800
  accentForeground: "255 255 255",
  primary: "24 24 27", // zinc-900
  primaryForeground: "255 255 255", // white

  neutralSurface: "242 242 244",
  neutralBorder: "212 212 216",
  neutralForeground: "63 63 70",

  infoSurface: "238 242 255", // indigo-50
  infoBorder: "199 210 254", // indigo-200
  infoForeground: "55 48 163", // indigo-800

  inProgressSurface: "240 249 255", // sky-50
  inProgressBorder: "186 230 253", // sky-200
  inProgressForeground: "7 89 133", // sky-800

  successSurface: "236 253 245", // emerald-50
  successBorder: "167 243 208", // emerald-200
  successForeground: "6 95 70", // emerald-800

  warningSurface: "255 251 235", // amber-50
  warningBorder: "253 230 138", // amber-200
  warningForeground: "146 64 14", // amber-800

  dangerSurface: "254 242 242", // red-50
  dangerBorder: "254 202 202", // red-200
  dangerForeground: "153 27 27", // red-800
};
