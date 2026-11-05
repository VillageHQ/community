import { deleteComment } from "@/modules/feed/service";
import { commentIdBodySchema } from "@/modules/feed/contract";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("feed-comment-delete", commentIdBodySchema, async (context, { commentId }) => {
  await deleteComment(context, commentId);
  return Response.json({ message: "Reply deleted." });
});
