import { closeAskBodySchema } from "@/modules/asks/contract";
import { asksRoutes } from "@/modules/asks/routes";
import { closeAsk } from "@/modules/asks/service";

export const POST = asksRoutes.member("asks-close", closeAskBodySchema, async (context, body) => {
  await closeAsk(context, body);
  return Response.json({ message: "Your ask is closed." });
});
