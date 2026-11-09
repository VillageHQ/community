import { askHelperBodySchema } from "@/modules/asks/contract";
import { asksRoutes } from "@/modules/asks/routes";
import { askHelperForIntro } from "@/shell/ask-helpers";

export const POST = asksRoutes.member("asks-ask-helper", askHelperBodySchema, async (context, body) => Response.json(await askHelperForIntro(context, body)));
