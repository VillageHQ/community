import { z } from "zod";

import { adminRoutes } from "@/modules/admin/routes";
import { logAdminAction } from "@/platform/observability/route-logging";
import { describeSchedule, weeklyScheduleSchema } from "@/platform/weekly-email/schedule";
import { saveWeeklySchedule } from "@/platform/weekly-email/schedule-store";
import { saveWeeklyEmailEnabled } from "@/shell/weekly-email-settings";

// The schedule and Founderhall's "Send the weekly digest" switch, saved together (Asks & digest).
const bodySchema = weeklyScheduleSchema.extend({ isEnabled: z.boolean().default(true) });

export const POST = adminRoutes.member(
  "admin-weekly-email-schedule",
  bodySchema,
  async ({ database, member }, { isEnabled, ...schedule }) => {
    await database.transaction(async (transaction) => {
      await saveWeeklySchedule(transaction, schedule);
      await saveWeeklyEmailEnabled(transaction, isEnabled);
    });
    logAdminAction("weekly_email_schedule_changed", member.id, `${isEnabled ? "on" : "off"}, ${describeSchedule(schedule)}`);
    return Response.json({ message: isEnabled ? `Saved. The weekly digest goes out ${describeSchedule(schedule)}.` : "Saved. The weekly digest is off." });
  },
  { adminOnly: true },
);
