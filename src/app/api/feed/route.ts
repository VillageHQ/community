import { feedPageBodySchema } from "@/modules/feed/contract";
import { readFeedPage } from "@/modules/feed/reads";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("feed-page", feedPageBodySchema, async ({ database, member }, { cursor }) =>
  Response.json(await readFeedPage(database, member, cursor)),
);
