import { z } from "zod";

import { saveMemberLinkedinUrl } from "@/modules/members/service-linkedin";
import { networkRoutes } from "@/modules/network/routes";

const linkedinBodySchema = z.object({ linkedinUrl: z.string().min(1, "Enter a LinkedIn URL.") });

export const POST = networkRoutes.member("network-linkedin", linkedinBodySchema, async (context, body) => {
  await saveMemberLinkedinUrl(context, body.linkedinUrl);
  return Response.json({ message: "LinkedIn profile saved." });
});
