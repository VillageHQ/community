import { commentPageBodySchema } from "@/modules/feed/contract";
import { readCommentPage } from "@/modules/feed/reads";
import { feedRoutes } from "@/modules/feed/routes";

export const POST = feedRoutes.member("feed-comment-page", commentPageBodySchema, async ({ database, member }, body) =>
  Response.json(await readCommentPage(database, member, body)),
);
