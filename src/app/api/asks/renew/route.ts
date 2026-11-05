import { askIdBodySchema } from "@/modules/asks/contract";
import { asksRoutes } from "@/modules/asks/routes";
import { renewAsk } from "@/modules/asks/service";

export const POST = asksRoutes.member("asks-renew", askIdBodySchema, async (context, { askId }) => {
  await renewAsk(context, askId);
  return Response.json({ message: "Your ask is back on the board." });
});
