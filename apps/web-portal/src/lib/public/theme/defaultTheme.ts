import type { PublicTheme } from "@/lib/public/theme/tokens";

export const defaultPublicTheme: PublicTheme = {
  light: {
    primary: "24 24 27", // zinc-900
    background: "245 245 247", // slightly stronger base layer
    surface: "255 255 255", // white
    border: "212 212 216", // clearer panel/input definition
    textPrimary: "24 24 27", // zinc-900
    textSecondary: "63 63 70", // zinc-700 for better readability
    accent: "67 56 202", // indigo-700
    accentHover: "55 48 163", // indigo-800
    accentForeground: "255 255 255", // white
  },
  dark: {
    primary: "228 228 231", // zinc-200
    background: "9 9 11", // zinc-950
    surface: "24 24 27", // zinc-900
    border: "63 63 70", // zinc-700
    textPrimary: "244 244 245", // zinc-100
    textSecondary: "161 161 170", // zinc-400
    accent: "99 102 241", // indigo-500
    accentHover: "129 140 248", // indigo-400
    accentForeground: "255 255 255",
  },
  design: {
    spacingSection: "2.5rem",
    spacingContainer: "1.5rem",
    spacingGap: "1rem",
    radiusCard: "0.875rem",
    radiusInput: "0.75rem",
    radiusButton: "0.75rem",
    shadowCard: "0 1px 2px rgb(24 24 27 / 0.05), 0 8px 20px rgb(24 24 27 / 0.03)",
    shadowCardHover: "0 8px 24px rgb(24 24 27 / 0.08)",
    fontHeroTitle: "2.5rem",
    fontSectionTitle: "1.25rem",
    fontBody: "0.9375rem",
    fontMeta: "0.8125rem",
  },
};

