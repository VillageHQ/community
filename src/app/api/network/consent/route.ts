import { z } from "zod";

import { recordSharingConsent } from "@/modules/network/service";
import { networkRoutes } from "@/modules/network/routes";

const consentBodySchema = z.object({
  acknowledged: z.literal(true, "Confirm that you understand what joining shares."),
});

export const POST = networkRoutes.member("network-consent", consentBodySchema, async (context) => {
  await recordSharingConsent(context);
  return Response.json({ message: "Consent recorded." });
});
