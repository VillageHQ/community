import "server-only";

import { eq } from "drizzle-orm";
import { cache } from "react";

import { communityBranding, DEFAULT_COMMUNITY_NAME } from "../../database/branding-schema.ts";
import { getDatabase, type Database } from "../../database/client.ts";
import { DEFAULT_ACCENT_COLOR, parseAccentColor } from "../design/accent.ts";
import { withLoggedFallback } from "../route-logging.ts";
import { API_ROUTES } from "../routes.ts";
import { LOGO_BACKDROPS, parseLogoBackdrop, type LogoBackdrop, type LogoContentType } from "./logo-rules.ts";

export type CommunityLogo = { url: string; backdrop: LogoBackdrop };

export type Branding = {
  name: string;
  descriptor: string;
  accentColor: string;
  logo: CommunityLogo | null;
  isSaved: boolean;
};

export type BrandingFields = { name: string; descriptor: string; accentColor: string };
export type LogoFile = { bytes: Buffer; contentType: LogoContentType; backdrop: LogoBackdrop };

export const DEFAULT_BRANDING: Branding = {
  name: DEFAULT_COMMUNITY_NAME,
  descriptor: "",
  accentColor: DEFAULT_ACCENT_COLOR,
  logo: null,
  isSaved: false,
};

const SINGLETON_ROW = true;

function toCommunityLogo(logoUpdatedAt: Date | null, backdrop: string): CommunityLogo | null {
  if (!logoUpdatedAt) return null;
  return {
    url: `${API_ROUTES.brandingLogo}?v=${logoUpdatedAt.getTime()}`,
    backdrop: parseLogoBackdrop(backdrop),
  };
}

export async function readBranding(database: Database): Promise<Branding> {
  const [row] = await database
    .select({
      name: communityBranding.name,
      descriptor: communityBranding.descriptor,
      accentColor: communityBranding.accentColor,
      savedAt: communityBranding.savedAt,
      logoUpdatedAt: communityBranding.logoUpdatedAt,
      logoBackdrop: communityBranding.logoBackdrop,
    })
    .from(communityBranding)
    .where(eq(communityBranding.isSingleton, SINGLETON_ROW));
  if (!row) return DEFAULT_BRANDING;

  return {
    name: row.name,
    descriptor: row.descriptor,
    accentColor: parseAccentColor(row.accentColor) ?? DEFAULT_ACCENT_COLOR,
    logo: toCommunityLogo(row.logoUpdatedAt, row.logoBackdrop),
    isSaved: row.savedAt !== null,
  };
}

const readBrandingOrDefault = withLoggedFallback("branding", DEFAULT_BRANDING, () => readBranding(getDatabase()));

export const readBrandingForPage = cache(readBrandingOrDefault);

export async function saveBranding(database: Database, { name, descriptor, accentColor }: BrandingFields) {
  const fields = { name, descriptor, accentColor, savedAt: new Date() };
  await database
    .insert(communityBranding)
    .values(fields)
    .onConflictDoUpdate({ target: communityBranding.isSingleton, set: fields });
}

export async function saveLogo(database: Database, { bytes, contentType, backdrop }: LogoFile) {
  const fields = { logoBytes: bytes, logoContentType: contentType, logoBackdrop: backdrop, logoUpdatedAt: new Date() };
  await database
    .insert(communityBranding)
    .values(fields)
    .onConflictDoUpdate({ target: communityBranding.isSingleton, set: fields });
}

export async function deleteLogo(database: Database) {
  await database
    .update(communityBranding)
    .set({ logoBytes: null, logoContentType: null, logoBackdrop: LOGO_BACKDROPS.light, logoUpdatedAt: null })
    .where(eq(communityBranding.isSingleton, SINGLETON_ROW));
}

export async function readLogo(database: Database) {
  const [row] = await database
    .select({
      bytes: communityBranding.logoBytes,
      contentType: communityBranding.logoContentType,
      updatedAt: communityBranding.logoUpdatedAt,
    })
    .from(communityBranding)
    .where(eq(communityBranding.isSingleton, SINGLETON_ROW));
  if (!row?.bytes || !row.contentType || !row.updatedAt) return null;
  return { bytes: row.bytes, contentType: row.contentType, version: String(row.updatedAt.getTime()) };
}
