import { createPost } from "@/modules/feed/service";
import { createPostBodySchema } from "@/modules/feed/contract";
import { enforcePostingLimit, POSTING_KINDS } from "@/modules/feed/limits";
import { feedRoutes } from "@/modules/feed/routes";

export const POST = feedRoutes.member("feed-post-create", createPostBodySchema, async (context, body) => {
  await enforcePostingLimit(context.database, context.member.id, POSTING_KINDS.post);
  return Response.json(await createPost(context, body));
});
