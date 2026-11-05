import { editComment } from "@/lib/feed/feed-actions";
import { editCommentBodySchema } from "@/lib/feed/feed-api";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("feed-comment-edit", editCommentBodySchema, async (context, body) =>
  Response.json(await editComment(context, body)),
);
