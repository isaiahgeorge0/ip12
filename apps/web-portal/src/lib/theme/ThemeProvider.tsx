"use client";

import { createContext, useContext, type ReactNode, useMemo } from "react";
import { defaultTheme } from "@/lib/theme/defaultTheme";
import type { ThemeTokens } from "@/lib/theme/tokens";

type ThemeContextValue = {
  theme: ThemeTokens;
};

const ThemeContext = createContext<ThemeContextValue>({ theme: defaultTheme });

type ThemeProviderProps = {
  children: ReactNode;
  /** Future-ready: inject an agency-specific theme override */
  theme?: Partial<ThemeTokens>;
};

function toCssVars(theme: ThemeTokens): Record<string, string> {
  return {
    "--t-background": theme.background,
    "--t-surface": theme.surface,
    "--t-surface-muted": theme.surfaceMuted,
    "--t-border": theme.border,
    "--t-foreground": theme.foreground,
    "--t-muted-foreground": theme.mutedForeground,
    "--t-accent": theme.accent,
    "--t-accent-hover": theme.accentHover,
    "--t-accent-foreground": theme.accentForeground,
    "--t-primary": theme.primary,
    "--t-primary-foreground": theme.primaryForeground,

    "--t-neutral-surface": theme.neutralSurface,
    "--t-neutral-border": theme.neutralBorder,
    "--t-neutral-foreground": theme.neutralForeground,

    "--t-info-surface": theme.infoSurface,
    "--t-info-border": theme.infoBorder,
    "--t-info-foreground": theme.infoForeground,

    "--t-inprogress-surface": theme.inProgressSurface,
    "--t-inprogress-border": theme.inProgressBorder,
    "--t-inprogress-foreground": theme.inProgressForeground,

    "--t-success-surface": theme.successSurface,
    "--t-success-border": theme.successBorder,
    "--t-success-foreground": theme.successForeground,

    "--t-warning-surface": theme.warningSurface,
    "--t-warning-border": theme.warningBorder,
    "--t-warning-foreground": theme.warningForeground,

    "--t-danger-surface": theme.dangerSurface,
    "--t-danger-border": theme.dangerBorder,
    "--t-danger-foreground": theme.dangerForeground,
  };
}

export function ThemeProvider({ children, theme: themeOverride }: ThemeProviderProps) {
  const theme = useMemo<ThemeTokens>(() => ({ ...defaultTheme, ...(themeOverride ?? {}) }), [themeOverride]);
  const cssVars = useMemo(() => toCssVars(theme), [theme]);

  return (
    <ThemeContext.Provider value={{ theme }}>
      <div style={cssVars as React.CSSProperties}>{children}</div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeTokens {
  return useContext(ThemeContext).theme;
}
