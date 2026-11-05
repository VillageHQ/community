export const THEMES = { light: "light", dark: "dark" } as const;

export type Theme = (typeof THEMES)[keyof typeof THEMES];

export const THEME_COOKIE = "community-theme";
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const DARK_CLASS = "dark";

export const SYSTEM_THEME_SCRIPT = `if(matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.classList.add("${DARK_CLASS}")`;

export function parseTheme(value: string | undefined): Theme | null {
  if (value === THEMES.light || value === THEMES.dark) return value;
  return null;
}
