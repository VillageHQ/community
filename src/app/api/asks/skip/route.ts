import { ASK_ERROR_CODES } from "@/modules/asks/contract";
import { skipAskBodySchema } from "@/modules/asks/contract-today";
import { isAskStillHelpable } from "@/modules/asks/reads-could-help";
import { asksRoutes } from "@/modules/asks/routes";
import { skipAsk } from "@/modules/asks/service-skip";
import { RequestError } from "@/platform/http/request-error";

const NOT_FOUND_STATUS = 404;

export const POST = asksRoutes.member("asks-skip", skipAskBodySchema, async ({ database, member }, { askId }) => {
  if (!(await isAskStillHelpable(database, member.id, askId))) {
    throw new RequestError(NOT_FOUND_STATUS, ASK_ERROR_CODES.notFound, "This ask isn't available anymore.");
  }
  return Response.json(await skipAsk(database, member.id, askId));
});
