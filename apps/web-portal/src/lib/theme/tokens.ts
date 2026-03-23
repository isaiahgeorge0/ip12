export type ThemeToken =
  | "background"
  | "surface"
  | "surfaceMuted"
  | "border"
  | "foreground"
  | "mutedForeground"
  | "accent"
  | "accentHover"
  | "accentForeground"
  | "primary"
  | "primaryForeground"
  | "neutralSurface"
  | "neutralBorder"
  | "neutralForeground"
  | "infoSurface"
  | "infoBorder"
  | "infoForeground"
  | "inProgressSurface"
  | "inProgressBorder"
  | "inProgressForeground"
  | "successSurface"
  | "successBorder"
  | "successForeground"
  | "warningSurface"
  | "warningBorder"
  | "warningForeground"
  | "dangerSurface"
  | "dangerBorder"
  | "dangerForeground";

/**
 * Theme values are stored as RGB triples (e.g. "24 24 27") so Tailwind can
 * compose alpha via `rgb(var(--t-primary) / <alpha-value>)`.
 */
export type ThemeTokens = Record<ThemeToken, string>;
