import { transitionIntro } from "@/lib/intros/intro-actions";
import { introTransitionBodySchema } from "@/lib/intros/intro-api";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute("intros-transition", introTransitionBodySchema, async (context, body) =>
  Response.json(await transitionIntro(context, body)),
);
