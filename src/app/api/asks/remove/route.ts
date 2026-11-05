import { askIdBodySchema } from "@/modules/asks/contract";
import { asksRoutes } from "@/modules/asks/routes";
import { removeAsk } from "@/modules/asks/service";

export const POST = asksRoutes.member(
  "asks-remove",
  askIdBodySchema,
  async (context, { askId }) => {
    await removeAsk(context, askId);
    return Response.json({ message: "The ask is gone. A copy stays in the audit log." });
  },
  { adminOnly: true },
);
