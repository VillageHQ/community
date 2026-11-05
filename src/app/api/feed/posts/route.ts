import { createPost } from "@/lib/feed/feed-actions";
import { createPostBodySchema } from "@/lib/feed/feed-api";
import { enforcePostingLimit, POSTING_KINDS } from "@/lib/feed/posting-limit";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("feed-post-create", createPostBodySchema, async (context, body) => {
  await enforcePostingLimit(context.database, context.member.id, POSTING_KINDS.post);
  return Response.json(await createPost(context, body));
});
