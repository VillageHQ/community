import { readResponseMessage } from "../read-response-message.ts";
import { API_ROUTES } from "../routes.ts";
import {
  ACCEPTED_LOGO_TYPES,
  LOGO_BACKDROP_PARAM,
  LOGO_BACKDROPS,
  LOGO_CONTENT_TYPES,
  LOGO_TOO_LARGE_MESSAGE,
  LOGO_WRONG_TYPE_MESSAGE,
  MAXIMUM_LOGO_BYTES,
  MAXIMUM_LOGO_EDGE_PX,
  pickLogoBackdrop,
} from "./logo-rules.ts";

const RESIZED_LOGO_QUALITY = 0.9;
const BACKDROP_SAMPLE_EDGE_PX = 32;
const FALLBACK_ERROR_MESSAGE = "We couldn't save that logo. Try again.";

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, LOGO_CONTENT_TYPES.webp, RESIZED_LOGO_QUALITY);
  });
}

function readBackdrop(bitmap: ImageBitmap) {
  const canvas = document.createElement("canvas");
  canvas.width = BACKDROP_SAMPLE_EDGE_PX;
  canvas.height = BACKDROP_SAMPLE_EDGE_PX;
  const context = canvas.getContext("2d");
  if (!context) return LOGO_BACKDROPS.light;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return pickLogoBackdrop(context.getImageData(0, 0, canvas.width, canvas.height).data);
}

async function shrinkBitmap(bitmap: ImageBitmap, file: File) {
  const scale = MAXIMUM_LOGO_EDGE_PX / Math.max(bitmap.width, bitmap.height);
  if (scale >= 1 && file.size <= MAXIMUM_LOGO_BYTES) return file;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * Math.min(scale, 1));
  canvas.height = Math.round(bitmap.height * Math.min(scale, 1));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return (await canvasToBlob(canvas)) ?? file;
}

async function prepareLogo(file: File) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { logo: file, backdrop: LOGO_BACKDROPS.light };

  const prepared = { logo: await shrinkBitmap(bitmap, file), backdrop: readBackdrop(bitmap) };
  bitmap.close();
  return prepared;
}

async function sendLogoRequest(url: string, init: RequestInit) {
  const response = await fetch(url, init).catch(() => null);
  if (!response) throw new Error(FALLBACK_ERROR_MESSAGE);
  if (!response.ok) throw new Error(await readResponseMessage(response, FALLBACK_ERROR_MESSAGE));
}

export async function uploadLogo(file: File) {
  if (!ACCEPTED_LOGO_TYPES.includes(file.type)) throw new Error(LOGO_WRONG_TYPE_MESSAGE);

  const { logo, backdrop } = await prepareLogo(file);
  if (logo.size > MAXIMUM_LOGO_BYTES) throw new Error(LOGO_TOO_LARGE_MESSAGE);

  await sendLogoRequest(`${API_ROUTES.brandingLogo}?${LOGO_BACKDROP_PARAM}=${backdrop}`, {
    method: "POST",
    headers: { "Content-Type": logo.type },
    body: logo,
  });
}

export function removeLogo() {
  return sendLogoRequest(API_ROUTES.brandingLogo, { method: "DELETE" });
}
