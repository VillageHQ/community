import { ACCEPTED_IMAGE_TYPES, detectImageContentType, IMAGE_CONTENT_TYPES, type ImageContentType } from "../image-rules.ts";

export const LOGO_CONTENT_TYPES = IMAGE_CONTENT_TYPES;

export type LogoContentType = ImageContentType;

export const MAXIMUM_LOGO_BYTES = 512 * 1024;
export const MAXIMUM_LOGO_EDGE_PX = 512;
export const LOGO_TOO_LARGE_MESSAGE = "This logo is over 512 KB. Use a smaller image.";
export const LOGO_WRONG_TYPE_MESSAGE = "Use a PNG, JPEG or WebP image. SVG files aren't accepted.";

export const ACCEPTED_LOGO_TYPES = ACCEPTED_IMAGE_TYPES;

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

export const detectLogoContentType = detectImageContentType;
