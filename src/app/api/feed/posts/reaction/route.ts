import { setReaction } from "@/modules/feed/service";
import { setReactionBodySchema } from "@/modules/feed/contract";
import { feedRoutes } from "@/modules/feed/routes";

export const POST = feedRoutes.member("feed-post-reaction", setReactionBodySchema, async (context, body) =>
  Response.json({ reactions: await setReaction(context, body) }),
);
