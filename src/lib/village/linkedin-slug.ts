const LINKEDIN_HOST = "linkedin.com";
const PROFILE_PATH_PATTERN = /^\/in\/([^/]+)\/?$/;
const CONTROL_CHARACTERS = /\p{Cc}/u;

function parseUrl(linkedinUrl: string) {
  const trimmed = linkedinUrl.trim();
  const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

function decodeSlug(encodedSlug: string) {
  try {
    return decodeURIComponent(encodedSlug);
  } catch {
    return encodedSlug;
  }
}

export function readLinkedinSlug(linkedinUrl: string | null | undefined) {
  if (!linkedinUrl) return null;

  const url = parseUrl(linkedinUrl);
  if (!url) return null;

  const hostname = url.hostname.toLowerCase();
  if (hostname !== LINKEDIN_HOST && !hostname.endsWith(`.${LINKEDIN_HOST}`)) return null;

  const encodedSlug = url.pathname.match(PROFILE_PATH_PATTERN)?.[1];
  if (!encodedSlug) return null;

  const slug = decodeSlug(encodedSlug);
  if (CONTROL_CHARACTERS.test(slug)) return null;
  return slug.trim().toLowerCase() || null;
}

export function toLinkedinUrl(linkedinSlug: string) {
  return `https://www.${LINKEDIN_HOST}/in/${encodeURIComponent(linkedinSlug)}`;
}
