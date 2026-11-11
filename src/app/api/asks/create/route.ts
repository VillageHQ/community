import { ASK_KINDS, createAskBodySchema } from "@/modules/asks/contract";
import { ASK_POSTING_KINDS, enforceAskPostingLimit } from "@/modules/asks/limits";
import { asksRoutes } from "@/modules/asks/routes";
import { createAsk } from "@/modules/asks/service";
import { routeAskToHelpers } from "@/modules/asks/service-helpers";
import { logError } from "@/platform/observability/route-logging";
import { assertPostAllowance, findAskPaths } from "@/shell/ask-helpers";

// The ask is already saved, so a failure finding helpers must not look like a failed post: a retry would post it twice.
async function routeSafely(...routeArguments: Parameters<typeof routeAskToHelpers>) {
  try {
    return await routeAskToHelpers(...routeArguments);
  } catch (error) {
    logError("ask-helper-routing", error);
    return 0;
  }
}

export const POST = asksRoutes.member("asks-create", createAskBodySchema, async (context, body) => {
  await enforceAskPostingLimit(context.database, context.member.id, ASK_POSTING_KINDS.ask);
  const { id } = await createAsk(context, body, assertPostAllowance);
  const helperCount = body.kind === ASK_KINDS.ask ? await routeSafely(context, id, findAskPaths) : 0;
  return Response.json({ id, helperCount });
});
