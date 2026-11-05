import { editComment } from "@/lib/feed/feed-actions";
import { editCommentBodySchema } from "@/lib/feed/feed-api";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("feed-comment-edit", editCommentBodySchema, async (context, body) =>
  Response.json(await editComment(context, body)),
);
