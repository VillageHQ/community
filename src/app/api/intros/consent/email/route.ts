import { emailConsentLink } from "@/modules/intros/service";
import { consentEmailBodySchema } from "@/modules/intros/contract";
import { introsRoutes } from "@/modules/intros/routes";

export const POST = introsRoutes.member("intros-consent-email", consentEmailBodySchema, async (context, body) =>
  Response.json(await emailConsentLink(context, body)),
);
