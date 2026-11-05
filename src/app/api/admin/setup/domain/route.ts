import { z } from "zod";

import { confirmVillageDomain } from "@/modules/network/service-settings";
import { resolveAppUrl } from "@/platform/http/app-url";
import { networkRoutes } from "@/modules/network/routes";

const domainBodySchema = z.object({
  confirmed: z.literal(true, "Confirm that you added the domain."),
});

export const POST = networkRoutes.member(
  "setup-domain",
  domainBodySchema,
  async (context) => {
    const domain = new URL(resolveAppUrl(context.environment)).hostname;
    await confirmVillageDomain(context, domain);
    return Response.json({ message: "Domain confirmed." });
  },
  { adminOnly: true },
);
