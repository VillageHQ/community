"use client";

import { useSyncExternalStore } from "react";

import { SERVER_TIME_ZONE } from "@/modules/messages/rules-time";

function subscribeToNothing() {
  return () => undefined;
}

function readBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function readServerTimeZone() {
  return SERVER_TIME_ZONE;
}

export function useBrowserTimeZone() {
  return useSyncExternalStore(subscribeToNothing, readBrowserTimeZone, readServerTimeZone);
}
