import { adminRoutes } from "@/modules/admin/routes";
import { logAdminAction } from "@/platform/observability/route-logging";
import { describeSchedule, weeklyScheduleSchema } from "@/platform/weekly-email/schedule";
import { saveWeeklySchedule } from "@/platform/weekly-email/schedule-store";

export const POST = adminRoutes.member(
  "admin-weekly-email-schedule",
  weeklyScheduleSchema,
  async ({ database, member }, schedule) => {
    await saveWeeklySchedule(database, schedule);
    logAdminAction("weekly_email_schedule_changed", member.id, describeSchedule(schedule));
    return Response.json({ message: `Saved. The weekly email goes out ${describeSchedule(schedule)}.` });
  },
  { adminOnly: true },
);
