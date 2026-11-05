import { z } from "zod";

import { confirmEmailWithToken } from "@/lib/invites/email-confirmation";
import { createMemberRoute } from "@/platform/village/member-routes";

const confirmBodySchema = z.object({ token: z.string() });

export const POST = createMemberRoute("email-confirmation-confirm", confirmBodySchema, async (context, { token }) => {
  await confirmEmailWithToken(context, token);
  return Response.json({ message: "Your email is confirmed." });
});
