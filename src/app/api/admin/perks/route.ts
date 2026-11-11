import { adminRoutes } from "@/modules/admin/routes";
import { savePerksBodySchema } from "@/modules/perks/contract";
import { savePerksSettings } from "@/shell/perks-settings";

export const POST = adminRoutes.member(
  "admin-perks-save",
  savePerksBodySchema,
  async (context, body) => {
    const url = await savePerksSettings(context, body);
    return Response.json({ message: "Settings saved.", url });
  },
  { adminOnly: true },
);
