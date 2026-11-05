import { feedPageBodySchema } from "@/lib/feed/feed-api";
import { readFeedPage } from "@/lib/feed/feed-reads";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("feed-page", feedPageBodySchema, async ({ database, member }, { cursor }) =>
  Response.json(await readFeedPage(database, member, cursor)),
);
