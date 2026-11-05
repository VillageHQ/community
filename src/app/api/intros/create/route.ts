import { createIntroRequest } from "@/lib/intros/intro-actions";
import { createIntroBodySchema } from "@/lib/intros/intro-api";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("intros-create", createIntroBodySchema, async (context, body) =>
  Response.json(await createIntroRequest(context, body)),
);
