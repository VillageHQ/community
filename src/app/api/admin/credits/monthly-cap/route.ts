import { monthlyCapBodySchema } from "@/platform/village/contract";
import { setMonthlyCreditCap } from "@/modules/network/service-settings";
import { logAdminAction } from "@/platform/observability/route-logging";
import { networkRoutes } from "@/modules/network/routes";

export const POST = networkRoutes.member(
  "admin-monthly-cap",
  monthlyCapBodySchema,
  async (context, { cap }) => {
    await setMonthlyCreditCap(context, cap);
    logAdminAction("monthly_cap_changed", context.member.id, String(cap));
    return Response.json({ message: `Saved. Lookups stop at about ${cap.toLocaleString("en-US")} credits a month.` });
  },
  { adminOnly: true },
);
