"use client";

import { useSyncExternalStore } from "react";

import { DARK_CLASS, THEME_COOKIE, THEME_COOKIE_MAX_AGE_SECONDS, THEMES } from "@/lib/design/theme";

function subscribeToThemeChanges(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function readIsDark() {
  return document.documentElement.classList.contains(DARK_CLASS);
}

function readIsDarkOnServer() {
  return false;
}

export function useIsDarkTheme() {
  return useSyncExternalStore(subscribeToThemeChanges, readIsDark, readIsDarkOnServer);
}

export function applyTheme(isDark: boolean) {
  const theme = isDark ? THEMES.dark : THEMES.light;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  document.documentElement.classList.toggle(DARK_CLASS, isDark);
}
