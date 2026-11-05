import { newPostCountBodySchema } from "@/modules/feed/contract";
import { readNewPostCount } from "@/modules/feed/reads";
import { feedRoutes } from "@/modules/feed/routes";

export const POST = feedRoutes.member("feed-new-count", newPostCountBodySchema, async ({ database, member }, { since }) =>
  Response.json({ newPostCount: await readNewPostCount(database, member.id, since) }),
);
