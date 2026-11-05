"use client";

import { useSyncExternalStore } from "react";

import { SERVER_TIME_ZONE } from "@/lib/messages/message-time";

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
