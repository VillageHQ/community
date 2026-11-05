import { newPostCountBodySchema } from "@/modules/feed/contract";
import { readNewPostCount } from "@/modules/feed/reads";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("feed-new-count", newPostCountBodySchema, async ({ database, member }, { since }) =>
  Response.json({ newPostCount: await readNewPostCount(database, member.id, since) }),
);
