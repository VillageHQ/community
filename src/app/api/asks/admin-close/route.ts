import { askIdBodySchema } from "@/modules/asks/contract";
import { asksRoutes } from "@/modules/asks/routes";
import { closeAskAsAdmin } from "@/modules/asks/service";

export const POST = asksRoutes.member(
  "asks-admin-close",
  askIdBodySchema,
  async (context, { askId }) => {
    await closeAskAsAdmin(context, askId);
    return Response.json({ message: "Closed." });
  },
  { adminOnly: true },
);
