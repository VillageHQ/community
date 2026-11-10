import "server-only";

import { House } from "lucide-react";
import { createElement } from "react";

import { feedManifest } from "@/modules/feed/manifest";
import { MODULES } from "@/modules/registry";
import { ROUTES } from "@/platform/http/routes";
import { NAVIGATION_SECTIONS, type NavigationEntry, type NavigationSection } from "@/platform/modules/manifest";
import type { ShellNavigationItem } from "./navigation-rules";

const HOME_ENTRY: NavigationEntry = { label: "Home", href: ROUTES.feed, icon: House, section: NAVIGATION_SECTIONS.primary };

// The owner's order for the navigation; the phone bar shows the first four and puts the rest under More.
// A module missing here keeps its registry place after these.
const NAVIGATION_ORDER: readonly string[] = [feedManifest.id, "network", "intros", "messages", "members", "asks", "job-board", "perks", "chat", "admin"];

function readNavigationRank(id: string) {
  const rank = NAVIGATION_ORDER.indexOf(id);
  return rank === -1 ? NAVIGATION_ORDER.length : rank;
}

const ORDERED_MODULES = [...MODULES].sort((a, b) => readNavigationRank(a.manifest.id) - readNavigationRank(b.manifest.id));

export const NAVIGATION = ORDERED_MODULES.flatMap(({ manifest }) => manifest.navigation);

const ALL_MODULE_IDS: ReadonlySet<string> = new Set(MODULES.map(({ manifest }) => manifest.id));

function readEnabledEntries(enabledIds: ReadonlySet<string>) {
  const entries = ORDERED_MODULES.flatMap(({ manifest }) => (enabledIds.has(manifest.id) ? manifest.navigation : []));
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
