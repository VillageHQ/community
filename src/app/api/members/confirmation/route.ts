import { eq } from "drizzle-orm";
import { z } from "zod";

import { user } from "@/platform/database/auth-schema";
import { recordFailedAttempt } from "@/platform/rate-limit/attempt-rate-limit";
import { sendEmailConfirmation } from "@/modules/members/service-email-confirmation";
import { membersRoutes } from "@/modules/members/routes";

const CONFIRMATION_KEY_PREFIX = "email-confirmation";
const MAXIMUM_SENDS_PER_MINUTE = 3;
const CONFLICT_STATUS = 409;
const TOO_MANY_REQUESTS_STATUS = 429;
const BAD_GATEWAY_STATUS = 502;

export const POST = membersRoutes.member("email-confirmation-send", z.unknown(), async ({ database, environment, member }) => {
  const [account] = await database
    .select({ id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, member.id));
  if (!account || account.emailVerified) {
    return Response.json({ message: "Your email is already confirmed." }, { status: CONFLICT_STATUS });
  }

  const { isLimited } = await recordFailedAttempt(
    database,
    `${CONFIRMATION_KEY_PREFIX}|${member.id}`,
    MAXIMUM_SENDS_PER_MINUTE,
  );
  if (isLimited) {
    return Response.json(
      { message: "We just sent a few. Give it a minute and check your spam folder." },
      { status: TOO_MANY_REQUESTS_STATUS },
    );
  }

  if (!(await sendEmailConfirmation(database, environment, account))) {
    return Response.json(
      { message: "We couldn't send that email. Ask your admin to confirm you instead." },
      { status: BAD_GATEWAY_STATUS },
    );
  }
  return Response.json({ message: "Sent. Check your inbox." });
});
