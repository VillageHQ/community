import { z } from "zod";

import { detectImageContentType } from "@/platform/image-rules";
import { AVATAR_TOO_LARGE_MESSAGE, AVATAR_WRONG_TYPE_MESSAGE, MAXIMUM_AVATAR_BYTES } from "@/lib/members/avatar-rules";
import { deleteAvatar, saveAvatar } from "@/lib/members/profile";
import { createMemberBinaryRoute, createMemberRoute } from "@/platform/village/member-routes";

const UNPROCESSABLE_STATUS = 422;

export const POST = createMemberBinaryRoute(
  "profile-avatar-save",
  { maximumBytes: MAXIMUM_AVATAR_BYTES, tooLargeMessage: AVATAR_TOO_LARGE_MESSAGE },
  async ({ database, member }, bytes) => {
    const contentType = detectImageContentType(bytes);
    if (!contentType) {
      return Response.json({ message: AVATAR_WRONG_TYPE_MESSAGE }, { status: UNPROCESSABLE_STATUS });
    }

    await saveAvatar(database, member.id, bytes, contentType);
    return Response.json({ message: "Photo saved." });
  },
);

export const DELETE = createMemberRoute("profile-avatar-delete", z.unknown(), async ({ database, member }) => {
  await deleteAvatar(database, member.id);
  return Response.json({ message: "Photo removed." });
});
