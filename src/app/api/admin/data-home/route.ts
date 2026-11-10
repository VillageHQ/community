import { dataHomeBodySchema } from "@/platform/settings/data-home-api";
import { saveDataHomeAsAdmin } from "@/platform/settings/data-home";
import { adminRoutes } from "@/modules/admin/routes";

export const POST = adminRoutes.member(
  "data-home",
  dataHomeBodySchema,
  async (context, body) => {
    await saveDataHomeAsAdmin(context, body);
    return Response.json({ message: "Saved. Members see this on their Your data page." });
  },
  { adminOnly: true },
);
