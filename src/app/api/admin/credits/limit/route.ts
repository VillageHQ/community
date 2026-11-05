import { dailyLimitBodySchema } from "@/lib/admin/admin-api";
import { setDailyLookupLimit } from "@/lib/admin/settings-actions";
import { logAdminAction } from "@/platform/observability/route-logging";
import { createMemberRoute } from "@/lib/village/member-route";

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
