import { adminRoutes } from "@/modules/admin/routes";
import { EMAIL_TEST_OUTCOMES, sendEmailTest } from "@/platform/email/test-email";
import { emptyBodySchema } from "@/platform/http/contract";

const MESSAGES = {
  [EMAIL_TEST_OUTCOMES.sent]: "Test email sent to you.",
  [EMAIL_TEST_OUTCOMES.queued]: "Queued. It didn't go out on the first try, so it will be tried again in a minute.",
  [EMAIL_TEST_OUTCOMES.emailOff]: "Email is off. Add your Resend settings on your host first.",
};

// Only ever to the admin's own address.
export const POST = adminRoutes.member(
  "admin-email-test",
  emptyBodySchema,
  async ({ database, environment, member }) => {
    const outcome = await sendEmailTest(database, environment, member.id);
    return Response.json({ outcome, message: MESSAGES[outcome] });
  },
  { adminOnly: true },
);
