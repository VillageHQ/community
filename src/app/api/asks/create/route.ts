import { createAskBodySchema } from "@/modules/asks/contract";
import { ASK_POSTING_KINDS, enforceAskPostingLimit } from "@/modules/asks/limits";
import { asksRoutes } from "@/modules/asks/routes";
import { createAsk } from "@/modules/asks/service";

export const POST = asksRoutes.member("asks-create", createAskBodySchema, async (context, body) => {
  await enforceAskPostingLimit(context.database, context.member.id, ASK_POSTING_KINDS.ask);
  return Response.json(await createAsk(context, body));
});
