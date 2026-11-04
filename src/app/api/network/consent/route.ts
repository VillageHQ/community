import { z } from "zod";

import { recordSharingConsent } from "@/lib/village/member-network";
import { createMemberRoute } from "@/lib/village/member-route";

const consentBodySchema = z.object({
  acknowledged: z.literal(true, "Confirm that you understand what joining shares."),
});

export const POST = createMemberRoute("network-consent", consentBodySchema, async (context) => {
  await recordSharingConsent(context);
  return Response.json({ message: "Consent recorded." });
});
