import { readOwnAsks } from "@/modules/asks/reads";
import { asksRoutes } from "@/modules/asks/routes";
import { emptyBodySchema } from "@/platform/http/contract";
import { isAskIntroOn, readAskAllowance } from "@/shell/ask-helpers";

export const POST = asksRoutes.member("asks-own", emptyBodySchema, async ({ database, member }) => {
  const [allowance, canIntro] = await Promise.all([readAskAllowance(database, member.id), isAskIntroOn(database)]);
  return Response.json(await readOwnAsks(database, member.id, { allowance, canIntro }));
});
