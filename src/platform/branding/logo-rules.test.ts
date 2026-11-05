import { describe, expect, it } from "vitest";

import {
  detectLogoContentType,
  LOGO_BACKDROPS,
  LOGO_CONTENT_TYPES,
  parseLogoBackdrop,
  pickLogoBackdrop,
} from "./logo-rules";

const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0];
const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0, 0];
const WEBP_BYTES = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0];

function textBytes(text: string) {
  return new TextEncoder().encode(text);
}

function pixelsOf(...pixels: number[][]) {
  return new Uint8ClampedArray(pixels.flat());
}

const TRANSPARENT = [0, 0, 0, 0];
const WHITE = [255, 255, 255, 255];
const NAVY = [20, 33, 61, 255];

describe("the logo backdrop", () => {
  it("puts a white mark on transparency on a dark tile, so it stays visible", () => {
    expect(pickLogoBackdrop(pixelsOf(WHITE, TRANSPARENT))).toBe(LOGO_BACKDROPS.dark);
  });

  it("keeps a dark mark on transparency on a light tile", () => {
    expect(pickLogoBackdrop(pixelsOf(NAVY, TRANSPARENT))).toBe(LOGO_BACKDROPS.light);
  });

  it("keeps an opaque white logo on a light tile, because it has its own edge", () => {
    expect(pickLogoBackdrop(pixelsOf(WHITE, WHITE))).toBe(LOGO_BACKDROPS.light);
  });

  it("keeps a fully transparent image on a light tile", () => {
    expect(pickLogoBackdrop(pixelsOf(TRANSPARENT, TRANSPARENT))).toBe(LOGO_BACKDROPS.light);
  });

  it("treats anything unknown in the request as light", () => {
    expect(parseLogoBackdrop("<script>")).toBe(LOGO_BACKDROPS.light);
    expect(parseLogoBackdrop(null)).toBe(LOGO_BACKDROPS.light);
    expect(parseLogoBackdrop(LOGO_BACKDROPS.dark)).toBe(LOGO_BACKDROPS.dark);
  });
});

describe("logo detection", () => {
  it.each([
    [LOGO_CONTENT_TYPES.png, PNG_BYTES],
    [LOGO_CONTENT_TYPES.jpeg, JPEG_BYTES],
    [LOGO_CONTENT_TYPES.webp, WEBP_BYTES],
  ])("recognizes %s by its magic bytes", (contentType, bytes) => {
    expect(detectLogoContentType(new Uint8Array(bytes))).toBe(contentType);
  });

  it.each([
    ["SVG", textBytes('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
    ["SVG behind an XML header", textBytes('<?xml version="1.0"?><svg/>')],
    ["HTML", textBytes("<!doctype html><script>alert(1)</script>")],
    ["GIF", textBytes("GIF89a")],
    ["a RIFF file that isn't WebP", new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20])],
    ["a truncated PNG signature", new Uint8Array(PNG_BYTES.slice(0, 4))],
    ["an empty file", new Uint8Array()],
  ])("refuses %s", (_name, bytes) => {
    expect(detectLogoContentType(bytes)).toBeNull();
  });
});
