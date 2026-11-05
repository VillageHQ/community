import { transitionIntro } from "@/modules/intros/service";
import { introTransitionBodySchema } from "@/modules/intros/contract";
import { introsRoutes } from "@/modules/intros/routes";

export const POST = introsRoutes.member("intros-transition", introTransitionBodySchema, async (context, body) =>
  Response.json(await transitionIntro(context, body)),
);
