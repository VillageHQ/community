import { editPost } from "@/modules/feed/service";
import { editPostBodySchema } from "@/modules/feed/contract";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("feed-post-edit", editPostBodySchema, async (context, body) =>
  Response.json(await editPost(context, body)),
);
