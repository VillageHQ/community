import { makeNewConsentLink } from "@/modules/intros/service";
import { introIdBodySchema } from "@/modules/intros/contract";
import { introsRoutes } from "@/modules/intros/routes";

export const POST = introsRoutes.member("intros-consent-link", introIdBodySchema, async (context, { introId }) =>
  Response.json(await makeNewConsentLink(context, introId)),
);
