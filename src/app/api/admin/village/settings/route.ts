import { villageSettingsBodySchema } from "@/modules/network/contract-village-settings";
import { networkRoutes } from "@/modules/network/routes";
import { setVillageSearchSettings } from "@/modules/network/service-settings";
import { logAdminAction } from "@/platform/observability/route-logging";

export const POST = networkRoutes.member(
  "admin-village-settings",
  villageSettingsBodySchema,
  async (context, body) => {
    const saved = await setVillageSearchSettings(context, body);
    logAdminAction("village_settings_changed", context.member.id, `${saved.searchScope} ${saved.introducers}`);
    return Response.json({ message: "Saved. Searches and intro paths use these from now on." });
  },
  { adminOnly: true },
);
