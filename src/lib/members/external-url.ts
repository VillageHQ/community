const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:"]);
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const WHITESPACE_OR_CONTROL = /[\s\p{Cc}]/u;

function parseUrl(text: string) {
  try {
    return new URL(HAS_SCHEME.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
}

export function parseExternalUrl(text: string) {
  const trimmed = text.trim();
  if (!trimmed || WHITESPACE_OR_CONTROL.test(trimmed)) return null;

  const url = parseUrl(trimmed);
  if (!url || !ALLOWED_PROTOCOLS.has(url.protocol)) return null;
  if (url.username || url.password || !url.hostname.includes(".")) return null;
  return url.toString();
}

export function readExternalHost(externalUrl: string) {
  return new URL(externalUrl).hostname.replace(/^www\./, "");
}
