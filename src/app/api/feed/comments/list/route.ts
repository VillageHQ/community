import { commentPageBodySchema } from "@/modules/feed/contract";
import { readCommentPage } from "@/modules/feed/reads";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("feed-comment-page", commentPageBodySchema, async ({ database, member }, body) =>
  Response.json(await readCommentPage(database, member, body)),
);
