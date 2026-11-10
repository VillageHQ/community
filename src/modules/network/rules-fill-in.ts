import { FILL_IN_FIELDS, type FillInField } from "../members/contract-fill-in.ts";
import { PROFILE_LIMITS } from "../members/contract-profile.ts";
import { removeBidiControls, removeNullBytes } from "../../platform/text/safe-text.ts";

type VillageLocation = { city?: string | null; state?: string | null; country?: string | null } | null | undefined;
type VillageWork = { title?: string | null; company?: { name?: string | null; image_url?: string | null } | null } | null | undefined;

export type VillageProfileFacts = {
  avatar?: string | null;
  headline?: string | null;
  location?: VillageLocation;
  work_relevant?: VillageWork;
  work_history?: VillageWork[] | null;
};

const HEADLINE_LENGTH = 200;
const IMAGE_URL_LENGTH = 1000;
const HTTPS_PROTOCOL = "https:";
const WHITESPACE = /\s+/g;

function cleanLine(value: string | null | undefined, maximumLength: number) {
  if (!value) return undefined;
  const line = removeBidiControls(removeNullBytes(value)).replace(WHITESPACE, " ").trim();
  if (!line) return undefined;
  return line.length > maximumLength ? `${line.slice(0, maximumLength - 1).trimEnd()}…` : line;
}

// Only an https address is shown as an image, so a lookup can't put another kind of link on a page.
export function readSafeImageUrl(value: string | null | undefined) {
  if (!value || value.length > IMAGE_URL_LENGTH) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === HTTPS_PROTOCOL && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function readPlace(location: VillageLocation) {
  if (!location) return undefined;
  const parts = [location.city, location.city ? location.country : (location.state ?? location.country)].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

export function toFilledProfile(profile: VillageProfileFacts): Partial<Record<FillInField, string>> {
  const work = profile.work_relevant ?? profile.work_history?.[0] ?? null;
  const filled: Partial<Record<FillInField, string>> = {
    [FILL_IN_FIELDS.title]: cleanLine(work?.title, PROFILE_LIMITS.title),
    [FILL_IN_FIELDS.company]: cleanLine(work?.company?.name, PROFILE_LIMITS.company),
    [FILL_IN_FIELDS.location]: cleanLine(readPlace(profile.location), PROFILE_LIMITS.location),
    [FILL_IN_FIELDS.headline]: cleanLine(profile.headline, HEADLINE_LENGTH),
    [FILL_IN_FIELDS.face]: readSafeImageUrl(profile.avatar),
    [FILL_IN_FIELDS.companyLogo]: readSafeImageUrl(work?.company?.image_url),
  };
  return Object.fromEntries(Object.entries(filled).filter(([, value]) => value));
}
