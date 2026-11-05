import { transitionIntro } from "@/modules/intros/service";
import { introTransitionBodySchema } from "@/modules/intros/contract";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("intros-transition", introTransitionBodySchema, async (context, body) =>
  Response.json(await transitionIntro(context, body)),
);
