import { savePerksBodySchema } from "@/modules/perks/contract";
import { perksRoutes } from "@/modules/perks/routes";
import { savePerksEmbed } from "@/modules/perks/service";

export const POST = perksRoutes.member(
  "admin-perks-save",
  savePerksBodySchema,
  async (context, { code }) => {
    const url = await savePerksEmbed(context, code);
    return Response.json({ message: "Saved. Members see your perks marketplace.", url });
  },
  { adminOnly: true },
);
