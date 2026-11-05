import { setReaction } from "@/lib/feed/feed-actions";
import { setReactionBodySchema } from "@/lib/feed/feed-api";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("feed-post-reaction", setReactionBodySchema, async (context, body) =>
  Response.json({ reactions: await setReaction(context, body) }),
);
