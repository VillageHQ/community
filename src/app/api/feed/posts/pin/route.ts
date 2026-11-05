import { setPostPinned } from "@/lib/feed/feed-actions";
import { pinPostBodySchema } from "@/lib/feed/feed-api";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute(
  "feed-post-pin",
  pinPostBodySchema,
  async (context, body) => {
    await setPostPinned(context, body);
    return Response.json({ message: body.isPinned ? "Post pinned." : "Post unpinned." });
  },
  { adminOnly: true },
);
