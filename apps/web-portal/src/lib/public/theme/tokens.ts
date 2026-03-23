export type PublicThemePalette = {
  primary: string;
  background: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentHover: string;
  accentForeground: string;
};

export type PublicDesignTokens = {
  spacingSection: string;
  spacingContainer: string;
  spacingGap: string;
  radiusCard: string;
  radiusInput: string;
  radiusButton: string;
  shadowCard: string;
  shadowCardHover: string;
  fontHeroTitle: string;
  fontSectionTitle: string;
  fontBody: string;
  fontMeta: string;
};

export type PublicTheme = {
  light: PublicThemePalette;
  dark: PublicThemePalette;
  design: PublicDesignTokens;
};

