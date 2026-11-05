import { setPostPinned } from "@/modules/feed/service";
import { pinPostBodySchema } from "@/modules/feed/contract";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "feed-post-pin",
  pinPostBodySchema,
  async (context, body) => {
    await setPostPinned(context, body);
    return Response.json({ message: body.isPinned ? "Post pinned." : "Post unpinned." });
  },
  { adminOnly: true },
);
