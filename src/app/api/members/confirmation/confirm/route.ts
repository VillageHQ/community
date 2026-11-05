import { z } from "zod";

import { confirmEmailWithToken } from "@/modules/members/service-email-confirmation";
import { membersRoutes } from "@/modules/members/routes";

const confirmBodySchema = z.object({ token: z.string() });

export const POST = membersRoutes.member("email-confirmation-confirm", confirmBodySchema, async (context, { token }) => {
  await confirmEmailWithToken(context, token);
  return Response.json({ message: "Your email is confirmed." });
});
