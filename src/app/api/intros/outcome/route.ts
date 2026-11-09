import { recordIntroOutcome } from "@/modules/intros/service";
import { introOutcomeBodySchema } from "@/modules/intros/contract";
import { introsRoutes } from "@/modules/intros/routes";

export const POST = introsRoutes.member("intros-outcome", introOutcomeBodySchema, async (context, body) =>
  Response.json(await recordIntroOutcome(context, body)),
);
