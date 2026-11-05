import { offerHelpBodySchema } from "@/modules/asks/contract";
import { ASK_POSTING_KINDS, enforceAskPostingLimit } from "@/modules/asks/limits";
import { asksRoutes } from "@/modules/asks/routes";
import { offerHelp } from "@/modules/asks/service";
import { sendOfferAsMessage } from "@/shell/ask-offer-delivery";

export const POST = asksRoutes.member("asks-offer", offerHelpBodySchema, async (context, body) => {
  await enforceAskPostingLimit(context.database, context.member.id, ASK_POSTING_KINDS.offer);
  return Response.json(await offerHelp(context, body, sendOfferAsMessage));
});
