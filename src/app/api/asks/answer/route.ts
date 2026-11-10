import { answerAskBodySchema } from "@/modules/asks/contract";
import { ASK_POSTING_KINDS, enforceAskPostingLimit } from "@/modules/asks/limits";
import { asksRoutes } from "@/modules/asks/routes";
import { answerAsk } from "@/modules/asks/service";

export const POST = asksRoutes.member("asks-answer", answerAskBodySchema, async (context, body) => {
  await enforceAskPostingLimit(context.database, context.member.id, ASK_POSTING_KINDS.offer);
  return Response.json(await answerAsk(context, body));
});
