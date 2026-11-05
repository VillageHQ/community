import { setReaction } from "@/modules/feed/service";
import { setReactionBodySchema } from "@/modules/feed/contract";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("feed-post-reaction", setReactionBodySchema, async (context, body) =>
  Response.json({ reactions: await setReaction(context, body) }),
);
