import { createIntroRequest } from "@/modules/intros/service";
import { createIntroBodySchema } from "@/modules/intros/contract";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("intros-create", createIntroBodySchema, async (context, body) =>
  Response.json(await createIntroRequest(context, body)),
);
