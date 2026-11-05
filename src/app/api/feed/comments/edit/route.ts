import { editComment } from "@/modules/feed/service";
import { editCommentBodySchema } from "@/modules/feed/contract";
import { feedRoutes } from "@/modules/feed/routes";

export const POST = feedRoutes.member("feed-comment-edit", editCommentBodySchema, async (context, body) =>
  Response.json(await editComment(context, body)),
);
