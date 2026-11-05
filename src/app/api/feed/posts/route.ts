import { createPost } from "@/modules/feed/service";
import { createPostBodySchema } from "@/modules/feed/contract";
import { enforcePostingLimit, POSTING_KINDS } from "@/modules/feed/limits";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("feed-post-create", createPostBodySchema, async (context, body) => {
  await enforcePostingLimit(context.database, context.member.id, POSTING_KINDS.post);
  return Response.json(await createPost(context, body));
});
