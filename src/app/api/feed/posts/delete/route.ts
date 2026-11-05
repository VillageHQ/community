import { deletePost } from "@/lib/feed/feed-actions";
import { postIdBodySchema } from "@/lib/feed/feed-api";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("feed-post-delete", postIdBodySchema, async (context, { postId }) => {
  await deletePost(context, postId);
  return Response.json({ message: "Post deleted." });
});
