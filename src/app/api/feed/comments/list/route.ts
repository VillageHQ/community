import { commentPageBodySchema } from "@/lib/feed/feed-api";
import { readCommentPage } from "@/lib/feed/feed-reads";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("feed-comment-page", commentPageBodySchema, async ({ database, member }, body) =>
  Response.json(await readCommentPage(database, member, body)),
);
