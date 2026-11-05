import { editComment } from "@/modules/feed/service";
import { editCommentBodySchema } from "@/modules/feed/contract";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("feed-comment-edit", editCommentBodySchema, async (context, body) =>
  Response.json(await editComment(context, body)),
);
