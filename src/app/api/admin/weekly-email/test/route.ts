import { adminRoutes } from "@/modules/admin/routes";
import { emptyBodySchema } from "@/platform/http/contract";
import { sendWeeklyTest, TEST_SEND_OUTCOMES } from "@/shell/weekly-email";

const MESSAGES = {
  [TEST_SEND_OUTCOMES.sent]: "Sent. Check your inbox.",
  [TEST_SEND_OUTCOMES.queued]: "Queued. It didn't go out on the first try, so it will be tried again in a minute.",
  [TEST_SEND_OUTCOMES.emailOff]: "Email is off. Set up Resend in Settings first.",
  [TEST_SEND_OUTCOMES.switchedOff]: "You turned the weekly email off on your card. Turn it on to get a test.",
};

// Only ever to the admin's own address, with the admin's own items.
export const POST = adminRoutes.member(
  "admin-weekly-email-test",
  emptyBodySchema,
  async ({ database, environment, member }) => {
    const outcome = await sendWeeklyTest(database, environment, member);
    return Response.json({ outcome, message: MESSAGES[outcome] });
  },
  { adminOnly: true },
);
