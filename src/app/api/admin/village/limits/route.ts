import { villageLimitsBodySchema } from "@/modules/network/contract-village-admin";
import { networkRoutes } from "@/modules/network/routes";
import { saveVillageLimits } from "@/modules/network/service-village-admin";
import { logAdminAction } from "@/platform/observability/route-logging";

// Admin › Village › "Limits and switches": one Save for the whole form.
export const POST = networkRoutes.member(
  "admin-village-limits",
  villageLimitsBodySchema,
  async (context, body) => {
    await saveVillageLimits(context, body);
    logAdminAction("village_limits_changed", context.member.id, `${body.cap} ${body.dailyLimit} ${body.searchScope}`);
    return Response.json({ message: "Settings saved." });
  },
  { adminOnly: true },
);
