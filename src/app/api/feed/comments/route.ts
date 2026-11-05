import { createComment } from "@/lib/feed/feed-actions";
import { createCommentBodySchema } from "@/lib/feed/feed-api";
import { enforcePostingLimit, POSTING_KINDS } from "@/lib/feed/posting-limit";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("feed-comment-create", createCommentBodySchema, async (context, body) => {
  await enforcePostingLimit(context.database, context.member.id, POSTING_KINDS.comment);
  return Response.json(await createComment(context, body));
});
