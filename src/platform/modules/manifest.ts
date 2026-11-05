import type { LucideIcon } from "lucide-react";

export const MODULE_KINDS = { core: "core", toggleable: "toggleable" } as const;
export const NAVIGATION_SECTIONS = { primary: "primary", admin: "admin" } as const;

export type NavigationSection = (typeof NAVIGATION_SECTIONS)[keyof typeof NAVIGATION_SECTIONS];

export type NavigationEntry = {
  label: string;
  href: string;
  icon: LucideIcon;
  section: NavigationSection;
  badge?: string;
};

type ManifestFields = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  navigation: readonly NavigationEntry[];
  adminTabs: readonly { label: string; href: string }[];
  requires: readonly ToggleableManifest[];
  needsVillage: boolean;
  paths: { pages: readonly string[]; api: readonly string[] };
};

export type CoreManifest = ManifestFields & { kind: typeof MODULE_KINDS.core };
export type ToggleableManifest = ManifestFields & { kind: typeof MODULE_KINDS.toggleable; isOnByDefault: boolean };
export type ModuleManifest = CoreManifest | ToggleableManifest;
