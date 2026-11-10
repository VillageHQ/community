import { emptyBodySchema } from "@/platform/http/contract";
import { perksRoutes } from "@/modules/perks/routes";
import { removePerksEmbed } from "@/modules/perks/service";

export const POST = perksRoutes.member(
  "admin-perks-remove",
  emptyBodySchema,
  async (context) => {
    await removePerksEmbed(context);
    return Response.json({ message: "Removed. Members no longer see Perks." });
  },
  { adminOnly: true },
);
