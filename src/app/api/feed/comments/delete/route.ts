import { deleteComment } from "@/modules/feed/service";
import { commentIdBodySchema } from "@/modules/feed/contract";
import { feedRoutes } from "@/modules/feed/routes";

export const POST = feedRoutes.member("feed-comment-delete", commentIdBodySchema, async (context, { commentId }) => {
  await deleteComment(context, commentId);
  return Response.json({ message: "Reply deleted." });
});
