import { ACCEPTED_IMAGE_TYPES, IMAGE_CONTENT_TYPES } from "../../../platform/image-rules.ts";
import { readResponseMessage } from "../../../platform/http/read-response-message.ts";
import { API_ROUTES } from "../../../platform/http/routes.ts";
import {
  AVATAR_EDGE_PX,
  AVATAR_TOO_LARGE_MESSAGE,
  AVATAR_WRONG_TYPE_MESSAGE,
  MAXIMUM_AVATAR_BYTES,
} from "../contract-avatar.ts";

const AVATAR_QUALITY = 0.85;
const AVATAR_BACKDROP = "#ffffff";
const UNREADABLE_MESSAGE = "We couldn't read that photo. Try a different one.";
const FALLBACK_ERROR_MESSAGE = "We couldn't save that photo. Try again.";

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, IMAGE_CONTENT_TYPES.jpeg, AVATAR_QUALITY);
  });
}

async function cropToSquare(file: File) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error(UNREADABLE_MESSAGE);

  const edge = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_EDGE_PX;
  canvas.height = AVATAR_EDGE_PX;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(UNREADABLE_MESSAGE);
  context.fillStyle = AVATAR_BACKDROP;
  context.fillRect(0, 0, AVATAR_EDGE_PX, AVATAR_EDGE_PX);
  context.drawImage(
    bitmap,
    (bitmap.width - edge) / 2,
    (bitmap.height - edge) / 2,
    edge,
    edge,
    0,
    0,
    AVATAR_EDGE_PX,
    AVATAR_EDGE_PX,
  );
  bitmap.close();

  const resized = await canvasToBlob(canvas);
  if (!resized) throw new Error(UNREADABLE_MESSAGE);
  return resized;
}

async function sendAvatarRequest(init: RequestInit) {
  const response = await fetch(API_ROUTES.profileAvatar, init).catch(() => null);
  if (!response) throw new Error(FALLBACK_ERROR_MESSAGE);
  if (!response.ok) throw new Error(await readResponseMessage(response, FALLBACK_ERROR_MESSAGE));
}

export async function uploadAvatar(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error(AVATAR_WRONG_TYPE_MESSAGE);

  const avatar = await cropToSquare(file);
  if (avatar.size > MAXIMUM_AVATAR_BYTES) throw new Error(AVATAR_TOO_LARGE_MESSAGE);

  await sendAvatarRequest({ method: "POST", headers: { "Content-Type": avatar.type }, body: avatar });
}

export function removeAvatar() {
  return sendAvatarRequest({ method: "DELETE" });
}
