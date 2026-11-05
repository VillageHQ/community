import { z } from "zod";

import { saveMemberLinkedinUrl } from "@/modules/members/service-linkedin";
import { createMemberRoute } from "@/platform/village/member-routes";

const linkedinBodySchema = z.object({ linkedinUrl: z.string().min(1, "Enter a LinkedIn URL.") });

export const POST = createMemberRoute("network-linkedin", linkedinBodySchema, async (context, body) => {
  await saveMemberLinkedinUrl(context, body.linkedinUrl);
  return Response.json({ message: "LinkedIn profile saved." });
});
