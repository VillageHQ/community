import { createComment } from "@/modules/feed/service";
import { createCommentBodySchema } from "@/modules/feed/contract";
import { enforcePostingLimit, POSTING_KINDS } from "@/modules/feed/limits";
import { feedRoutes } from "@/modules/feed/routes";

export const POST = feedRoutes.member("feed-comment-create", createCommentBodySchema, async (context, body) => {
  await enforcePostingLimit(context.database, context.member.id, POSTING_KINDS.comment);
  return Response.json(await createComment(context, body));
});
