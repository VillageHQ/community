import { adminRoutes } from "@/modules/admin/routes";
import { emptyBodySchema } from "@/platform/http/contract";
import { removePerksMarketplace } from "@/shell/perks-settings";

export const POST = adminRoutes.member(
  "admin-perks-remove",
  emptyBodySchema,
  async (context) => {
    await removePerksMarketplace(context);
    return Response.json({ message: "Settings saved." });
  },
  { adminOnly: true },
);
