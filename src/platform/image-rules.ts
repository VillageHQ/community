export const IMAGE_CONTENT_TYPES = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
} as const;

export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[keyof typeof IMAGE_CONTENT_TYPES];

export const ACCEPTED_IMAGE_TYPES: readonly string[] = Object.values(IMAGE_CONTENT_TYPES);

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46];
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50];
const WEBP_SIGNATURE_OFFSET = 8;

function hasBytesAt(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((byte, position) => bytes[offset + position] === byte);
}

const IMAGE_SIGNATURE_CHECKS: Record<ImageContentType, (bytes: Uint8Array) => boolean> = {
  [IMAGE_CONTENT_TYPES.png]: (bytes) => hasBytesAt(bytes, PNG_SIGNATURE),
  [IMAGE_CONTENT_TYPES.jpeg]: (bytes) => hasBytesAt(bytes, JPEG_SIGNATURE),
  [IMAGE_CONTENT_TYPES.webp]: (bytes) =>
    hasBytesAt(bytes, RIFF_SIGNATURE) && hasBytesAt(bytes, WEBP_SIGNATURE, WEBP_SIGNATURE_OFFSET),
};

export function detectImageContentType(bytes: Uint8Array) {
  const contentTypes = Object.values(IMAGE_CONTENT_TYPES);
  return contentTypes.find((contentType) => IMAGE_SIGNATURE_CHECKS[contentType](bytes)) ?? null;
}
