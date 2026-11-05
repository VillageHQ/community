import { dailyLimitBodySchema } from "@/platform/village/contract";
import { setDailyLookupLimit } from "@/modules/network/service-settings";
import { logAdminAction } from "@/platform/observability/route-logging";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "admin-daily-limit",
  dailyLimitBodySchema,
  async (context, { limit }) => {
    await setDailyLookupLimit(context, limit);
    logAdminAction("daily_limit_changed", context.member.id, String(limit));
    return Response.json({ message: `Saved. Each member now gets ${limit} lookups a day.` });
  },
  { adminOnly: true },
);
