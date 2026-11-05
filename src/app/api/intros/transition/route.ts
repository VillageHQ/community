import { transitionIntro } from "@/lib/intros/intro-actions";
import { introTransitionBodySchema } from "@/lib/intros/intro-api";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("intros-transition", introTransitionBodySchema, async (context, body) =>
  Response.json(await transitionIntro(context, body)),
);
