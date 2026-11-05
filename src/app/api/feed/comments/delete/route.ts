import { deleteComment } from "@/lib/feed/feed-actions";
import { commentIdBodySchema } from "@/lib/feed/feed-api";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("feed-comment-delete", commentIdBodySchema, async (context, { commentId }) => {
  await deleteComment(context, commentId);
  return Response.json({ message: "Reply deleted." });
});
