import { editPost } from "@/modules/feed/service";
import { editPostBodySchema } from "@/modules/feed/contract";
import { feedRoutes } from "@/modules/feed/routes";

export const POST = feedRoutes.member("feed-post-edit", editPostBodySchema, async (context, body) =>
  Response.json(await editPost(context, body)),
);
