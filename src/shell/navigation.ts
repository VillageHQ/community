import "server-only";

import { House } from "lucide-react";
import { createElement } from "react";

import { feedManifest } from "@/modules/feed/manifest";
import { MODULES } from "@/modules/registry";
import { ROUTES } from "@/platform/http/routes";
import { NAVIGATION_SECTIONS, type NavigationEntry, type NavigationSection } from "@/platform/modules/manifest";
import type { ShellNavigationItem } from "./navigation-rules";

const HOME_ENTRY: NavigationEntry = { label: "Home", href: ROUTES.feed, icon: House, section: NAVIGATION_SECTIONS.primary };

export const NAVIGATION = MODULES.flatMap(({ manifest }) => manifest.navigation);

const ALL_MODULE_IDS: ReadonlySet<string> = new Set(MODULES.map(({ manifest }) => manifest.id));

function readEnabledEntries(enabledIds: ReadonlySet<string>) {
  const entries = MODULES.flatMap(({ manifest }) => (enabledIds.has(manifest.id) ? manifest.navigation : []));
  return enabledIds.has(feedManifest.id) ? entries : [HOME_ENTRY, ...entries];
}

export function selectNavigationItems(section: NavigationSection, isAdmin: boolean, enabledIds = ALL_MODULE_IDS) {
  if (section === NAVIGATION_SECTIONS.admin && !isAdmin) return [];
  return readEnabledEntries(enabledIds).filter((entry) => entry.section === section);
}

// A server component can't pass a Lucide component to a client one, so the shell gets rendered icons.
export function buildShellNavigation(enabledIds = ALL_MODULE_IDS): ShellNavigationItem[] {
  return readEnabledEntries(enabledIds).map(({ icon, ...entry }) => ({ ...entry, icon: createElement(icon, { "aria-hidden": true }) }));
}
