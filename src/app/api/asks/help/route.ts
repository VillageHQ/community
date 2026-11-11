import { helpAskBodySchema } from "@/modules/asks/contract";
import { ASK_POSTING_KINDS, enforceAskPostingLimit } from "@/modules/asks/limits";
import { asksRoutes } from "@/modules/asks/routes";
import { helpWithAsk } from "@/modules/asks/service-status";

export const POST = asksRoutes.member("asks-help", helpAskBodySchema, async (context, body) => {
  await enforceAskPostingLimit(context.database, context.member.id, ASK_POSTING_KINDS.offer);
  return Response.json(await helpWithAsk(context, body));
});
