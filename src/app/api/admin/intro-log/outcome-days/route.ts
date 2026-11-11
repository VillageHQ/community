import { outcomeDaysBodySchema } from "@/modules/intros/contract-outcome-days";
import { adminRoutes } from "@/modules/admin/routes";
import { saveOutcomeDays } from "@/modules/admin/service-intro-log";

export const POST = adminRoutes.member(
  "admin-intro-outcome-days",
  outcomeDaysBodySchema,
  async (context, { outcomeDays }) => {
    await saveOutcomeDays(context, outcomeDays);
    return Response.json({ outcomeDays });
  },
  { adminOnly: true },
);
