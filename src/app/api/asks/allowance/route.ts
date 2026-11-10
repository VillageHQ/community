import { allowanceBodySchema } from "@/modules/asks/contract";
import { asksRoutes } from "@/modules/asks/routes";
import { saveWeeklyAllowance } from "@/modules/asks/service";

export const POST = asksRoutes.member(
  "asks-allowance",
  allowanceBodySchema,
  async (context, { weeklyAllowance }) => {
    await saveWeeklyAllowance(context, weeklyAllowance);
    return Response.json({ weeklyAllowance });
  },
  { adminOnly: true },
);
