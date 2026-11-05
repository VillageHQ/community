import { asksRoutes } from "@/modules/asks/routes";
import { markOffersSeen } from "@/modules/asks/service";
import { emptyBodySchema } from "@/platform/http/contract";

export const POST = asksRoutes.member("asks-seen", emptyBodySchema, async (context) => {
  await markOffersSeen(context);
  return Response.json({ message: "Marked as seen." });
});
