import { ASK_KINDS, createAskBodySchema } from "@/modules/asks/contract";
import { ASK_POSTING_KINDS, enforceAskPostingLimit } from "@/modules/asks/limits";
import { asksRoutes } from "@/modules/asks/routes";
import { createAsk } from "@/modules/asks/service";
import { routeAskToHelpers } from "@/modules/asks/service-helpers";
import { assertAskAllowance, findAskPaths } from "@/shell/ask-helpers";

export const POST = asksRoutes.member("asks-create", createAskBodySchema, async (context, body) => {
  await enforceAskPostingLimit(context.database, context.member.id, ASK_POSTING_KINDS.ask);
  const { id } = await createAsk(context, body, assertAskAllowance);
  const helperCount = body.kind === ASK_KINDS.ask ? await routeAskToHelpers(context, id, findAskPaths) : 0;
  return Response.json({ id, helperCount });
});
