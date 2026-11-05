import { deletePost } from "@/modules/feed/service";
import { postIdBodySchema } from "@/modules/feed/contract";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("feed-post-delete", postIdBodySchema, async (context, { postId }) => {
  await deletePost(context, postId);
  return Response.json({ message: "Post deleted." });
});
