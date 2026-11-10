import { z } from "zod";

export const PERKS_PAGE = "/perks";
export const PERKS_ADMIN_PAGE = "/admin/perks";
export const PERKS_PAGE_TITLE = "Perks";
export const PERKS_HELP_URL = "https://support.builtfirst.com/en/articles/7833677-how-to-install-your-embed-iframe";
export const PERKS_EMBED_SETTING = "perks_embed_url";

export const PERKS_API_ROUTES = { save: "/api/admin/perks", remove: "/api/admin/perks/remove" } as const;

export const PERKS_LIMITS = { codeCharacters: 20_000 } as const;

export const PERKS_ERROR_CODES = { refused: "perks_refused" } as const;

export const PERKS_REFUSED_MESSAGE = "Paste the embed code from BuiltFirst. Other code isn't accepted.";

// Frames on /perks may come from BuiltFirst only. The page's own policy, on top of the site's.
export const PERKS_FRAME_SOURCES = "https://builtfirst.com https://*.builtfirst.com";
export const PERKS_FRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups";

const BUILTFIRST_HOST = "builtfirst.com";
const IFRAME_TAG = /<\s*iframe\b[^>]*>/gi;
const SRC_ATTRIBUTE = /\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
const HAS_IFRAME = /<\s*iframe\b/i;
const MARKUP_OR_SPACE = /[<>\s]/;
const ENTITY = /&(amp|quot|#39|#x27|lt|gt);/g;
const ENTITIES: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#x27;": "'", "&lt;": "<", "&gt;": ">" };

// A BuiltFirst address: https, builtfirst.com or one of its subdomains, no login part and no port.
export function readBuiltfirstUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (host !== BUILTFIRST_HOST && !host.endsWith(`.${BUILTFIRST_HOST}`)) return null;
  return url.href;
}

function readIframeSource(code: string) {
  for (const [tag] of code.matchAll(IFRAME_TAG)) {
    const match = tag.match(SRC_ATTRIBUTE);
    const source = match?.[1] ?? match?.[2] ?? match?.[3];
    if (source !== undefined) return source.replace(ENTITY, (entity) => ENTITIES[entity] ?? entity);
  }
  return null;
}

// The pasted embed code to the one address kept: the src of the first <iframe> that has one, or a bare https
// address. Scripts, styles and every other attribute are dropped. Pasted HTML is never stored or shown.
export function parsePerksEmbed(code: string): { url: string } | { error: string } {
  const text = code.trim();
  if (!text || text.length > PERKS_LIMITS.codeCharacters) return { error: PERKS_REFUSED_MESSAGE };
  let source: string | null = text;
  if (HAS_IFRAME.test(text)) source = readIframeSource(text);
  else if (MARKUP_OR_SPACE.test(text)) source = null;
  const url = source === null ? null : readBuiltfirstUrl(source);
  return url ? { url } : { error: PERKS_REFUSED_MESSAGE };
}

export const savePerksBodySchema = z.object({ code: z.string().max(PERKS_LIMITS.codeCharacters, PERKS_REFUSED_MESSAGE) });
