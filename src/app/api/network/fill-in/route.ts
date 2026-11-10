
import { emptyBodySchema } from "@/platform/http/contract";
import { fillInMemberNow, FILL_IN_OUTCOMES } from "@/modules/network/service-fill-in";
import { networkRoutes } from "@/modules/network/routes";

const OUTCOME_MESSAGES = {
  [FILL_IN_OUTCOMES.found]: "Filled in. Check the lines below, and hide any you don't want.",
  [FILL_IN_OUTCOMES.notFound]: "We couldn't find you on public profiles. You can fill in your card yourself.",
  [FILL_IN_OUTCOMES.notAllowed]: "Nothing was filled in, because you asked us not to look you up.",
} as const;

export const POST = networkRoutes.member("network-fill-in", emptyBodySchema, async (context) => {
  const outcome = await fillInMemberNow(context);
  return Response.json({ message: OUTCOME_MESSAGES[outcome] });
});
