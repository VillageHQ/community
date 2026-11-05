import { deletePost } from "@/modules/feed/service";
import { postIdBodySchema } from "@/modules/feed/contract";
import { feedRoutes } from "@/modules/feed/routes";

export const POST = feedRoutes.member("feed-post-delete", postIdBodySchema, async (context, { postId }) => {
  await deletePost(context, postId);
  return Response.json({ message: "Post deleted." });
});
