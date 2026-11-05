import { createIntroRequest } from "@/lib/intros/intro-actions";
import { createIntroBodySchema } from "@/lib/intros/intro-api";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("intros-create", createIntroBodySchema, async (context, body) =>
  Response.json(await createIntroRequest(context, body)),
);
