export const LOGO_CONTENT_TYPES = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
} as const;

export type LogoContentType = (typeof LOGO_CONTENT_TYPES)[keyof typeof LOGO_CONTENT_TYPES];

export const MAXIMUM_LOGO_BYTES = 512 * 1024;
export const MAXIMUM_LOGO_EDGE_PX = 512;
export const LOGO_TOO_LARGE_MESSAGE = "This logo is over 512 KB. Use a smaller image.";
export const LOGO_WRONG_TYPE_MESSAGE = "Use a PNG, JPEG or WebP image. SVG files aren't accepted.";

export const ACCEPTED_LOGO_TYPES: readonly string[] = Object.values(LOGO_CONTENT_TYPES);

export const LOGO_BACKDROP_PARAM = "backdrop";
export const LOGO_BACKDROPS = { light: "light", dark: "dark" } as const;

export type LogoBackdrop = (typeof LOGO_BACKDROPS)[keyof typeof LOGO_BACKDROPS];

const VISIBLE_ALPHA = 32;
const MINIMUM_TRANSPARENT_SHARE = 0.02;
const LIGHT_MARK_LUMINANCE = 0.72;
const CHANNELS_PER_PIXEL = 4;

function readPixelLuminance(pixels: Uint8ClampedArray, offset: number) {
  const [red = 0, green = 0, blue = 0] = pixels.subarray(offset, offset + 3);
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

export function pickLogoBackdrop(pixels: Uint8ClampedArray): LogoBackdrop {
  let visibleCount = 0;
  let transparentCount = 0;
  let luminanceTotal = 0;
  for (let offset = 0; offset < pixels.length; offset += CHANNELS_PER_PIXEL) {
    if ((pixels[offset + 3] ?? 0) < VISIBLE_ALPHA) {
      transparentCount += 1;
      continue;
    }
    visibleCount += 1;
    luminanceTotal += readPixelLuminance(pixels, offset);
  }
  const totalCount = visibleCount + transparentCount;
  if (visibleCount === 0 || transparentCount / totalCount < MINIMUM_TRANSPARENT_SHARE) return LOGO_BACKDROPS.light;
  return luminanceTotal / visibleCount >= LIGHT_MARK_LUMINANCE ? LOGO_BACKDROPS.dark : LOGO_BACKDROPS.light;
}

export function parseLogoBackdrop(value: string | null): LogoBackdrop {
  return value === LOGO_BACKDROPS.dark ? LOGO_BACKDROPS.dark : LOGO_BACKDROPS.light;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46];
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50];
const WEBP_SIGNATURE_OFFSET = 8;

function hasBytesAt(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((byte, position) => bytes[offset + position] === byte);
}

const LOGO_SIGNATURE_CHECKS: Record<LogoContentType, (bytes: Uint8Array) => boolean> = {
  [LOGO_CONTENT_TYPES.png]: (bytes) => hasBytesAt(bytes, PNG_SIGNATURE),
  [LOGO_CONTENT_TYPES.jpeg]: (bytes) => hasBytesAt(bytes, JPEG_SIGNATURE),
  [LOGO_CONTENT_TYPES.webp]: (bytes) =>
    hasBytesAt(bytes, RIFF_SIGNATURE) && hasBytesAt(bytes, WEBP_SIGNATURE, WEBP_SIGNATURE_OFFSET),
};

export function detectLogoContentType(bytes: Uint8Array) {
  const contentTypes = Object.values(LOGO_CONTENT_TYPES);
  return contentTypes.find((contentType) => LOGO_SIGNATURE_CHECKS[contentType](bytes)) ?? null;
}
