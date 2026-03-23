"use client";

import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from "react";
import { defaultPublicTheme } from "@/lib/public/theme/defaultTheme";
import type { PublicTheme, PublicThemePalette } from "@/lib/public/theme/tokens";

type PublicThemeMode = "light" | "dark" | "system";

type PublicThemeContextValue = {
  theme: PublicTheme;
  mode: PublicThemeMode;
  resolvedMode: "light" | "dark";
};

const PublicThemeContext = createContext<PublicThemeContextValue>({
  theme: defaultPublicTheme,
  mode: "light",
  resolvedMode: "light",
});

type PublicThemeProviderProps = {
  children: ReactNode;
  theme?: Partial<PublicTheme>;
  mode?: PublicThemeMode;
};

function resolvePalette(theme: PublicTheme, mode: PublicThemeMode, systemDark: boolean): PublicThemePalette {
  if (mode === "dark") return theme.dark;
  if (mode === "system") return systemDark ? theme.dark : theme.light;
  return theme.light;
}

export function PublicThemeProvider({ children, theme: override, mode = "light" }: PublicThemeProviderProps) {
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const theme = useMemo<PublicTheme>(() => {
    const o = override ?? {};
    return {
      light: { ...defaultPublicTheme.light, ...(o.light ?? {}) },
      dark: { ...defaultPublicTheme.dark, ...(o.dark ?? {}) },
      design: { ...defaultPublicTheme.design, ...(o.design ?? {}) },
    };
  }, [override]);

  const palette = useMemo(() => resolvePalette(theme, mode, systemDark), [theme, mode, systemDark]);
  const resolvedMode = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  const cssVars = useMemo(
    () =>
      ({
        "--pt-primary": palette.primary,
        "--pt-background": palette.background,
        "--pt-surface": palette.surface,
        "--pt-border": palette.border,
        "--pt-text-primary": palette.textPrimary,
        "--pt-text-secondary": palette.textSecondary,
        "--pt-accent": palette.accent,
        "--pt-accent-hover": palette.accentHover,
        "--pt-accent-foreground": palette.accentForeground,
        "--pt-spacing-section": theme.design.spacingSection,
        "--pt-spacing-container": theme.design.spacingContainer,
        "--pt-spacing-gap": theme.design.spacingGap,
        "--pt-radius-card": theme.design.radiusCard,
        "--pt-radius-input": theme.design.radiusInput,
        "--pt-radius-button": theme.design.radiusButton,
        "--pt-shadow-card": theme.design.shadowCard,
        "--pt-shadow-card-hover": theme.design.shadowCardHover,
        "--pt-font-hero-title": theme.design.fontHeroTitle,
        "--pt-font-section-title": theme.design.fontSectionTitle,
        "--pt-font-body": theme.design.fontBody,
        "--pt-font-meta": theme.design.fontMeta,
      }) as React.CSSProperties,
    [palette, theme]
  );

  return (
    <PublicThemeContext.Provider value={{ theme, mode, resolvedMode }}>
      <div style={cssVars}>{children}</div>
    </PublicThemeContext.Provider>
  );
}

export function usePublicTheme() {
  return useContext(PublicThemeContext);
}

