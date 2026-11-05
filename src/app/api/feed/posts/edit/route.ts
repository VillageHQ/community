import { editPost } from "@/lib/feed/feed-actions";
import { editPostBodySchema } from "@/lib/feed/feed-api";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("feed-post-edit", editPostBodySchema, async (context, body) =>
  Response.json(await editPost(context, body)),
);
