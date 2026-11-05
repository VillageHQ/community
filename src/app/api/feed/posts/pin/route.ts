import { setPostPinned } from "@/modules/feed/service";
import { pinPostBodySchema } from "@/modules/feed/contract";
import { feedRoutes } from "@/modules/feed/routes";

export const POST = feedRoutes.member(
  "feed-post-pin",
  pinPostBodySchema,
  async (context, body) => {
    await setPostPinned(context, body);
    return Response.json({ message: body.isPinned ? "Post pinned." : "Post unpinned." });
  },
  { adminOnly: true },
);
