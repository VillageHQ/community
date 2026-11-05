import { feedPageBodySchema } from "@/modules/feed/contract";
import { readFeedPage } from "@/modules/feed/reads";
import { feedRoutes } from "@/modules/feed/routes";

export const POST = feedRoutes.member("feed-page", feedPageBodySchema, async ({ database, member }, { cursor }) =>
  Response.json(await readFeedPage(database, member, cursor)),
);
