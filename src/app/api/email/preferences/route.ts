import { z } from "zod";

import { EMAIL_TOPICS } from "@/platform/email/kinds";
import { readOptedOutTopics, setEmailTopic } from "@/platform/email/unsubscribe";
import { platformRoutes } from "@/platform/modules/platform-routes";

const preferenceBodySchema = z.object({ topic: z.enum(Object.values(EMAIL_TOPICS)), isOn: z.boolean() });

export const POST = platformRoutes.member("email-preferences", preferenceBodySchema, async ({ database, member }, { topic, isOn }) => {
  await setEmailTopic(database, { memberId: member.id, topic }, isOn);
  const optedOut = await readOptedOutTopics(database, member.id);
  return Response.json({ topic, isOn: !optedOut.has(topic) });
});
