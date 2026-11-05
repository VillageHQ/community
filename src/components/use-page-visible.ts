"use client";

import { useSyncExternalStore } from "react";

const VISIBILITY_EVENT = "visibilitychange";
const VISIBLE_STATE = "visible";

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener(VISIBILITY_EVENT, onChange);
  return () => document.removeEventListener(VISIBILITY_EVENT, onChange);
}

function readIsVisible() {
  return document.visibilityState === VISIBLE_STATE;
}

function readIsVisibleOnServer() {
  return false;
}

export function usePageVisible() {
  return useSyncExternalStore(subscribeToVisibility, readIsVisible, readIsVisibleOnServer);
}
