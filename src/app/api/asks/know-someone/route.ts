import { knowSomeoneBodySchema } from "@/modules/asks/contract";
import { asksRoutes } from "@/modules/asks/routes";
import { knowSomeone } from "@/shell/ask-helpers";

export const POST = asksRoutes.member("asks-know-someone", knowSomeoneBodySchema, async (context, body) => Response.json(await knowSomeone(context, body)));
