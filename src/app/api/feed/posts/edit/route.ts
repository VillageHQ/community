import { editPost } from "@/lib/feed/feed-actions";
import { editPostBodySchema } from "@/lib/feed/feed-api";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("feed-post-edit", editPostBodySchema, async (context, body) =>
  Response.json(await editPost(context, body)),
);
