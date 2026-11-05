"use client";

import { useSyncExternalStore } from "react";

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

function subscribeToDesktopChanges(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_MEDIA_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readIsDesktop() {
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function readIsDesktopOnServer() {
  return true;
}

export function useIsDesktop() {
  return useSyncExternalStore(subscribeToDesktopChanges, readIsDesktop, readIsDesktopOnServer);
}
