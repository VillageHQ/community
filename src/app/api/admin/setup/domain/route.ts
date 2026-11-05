import { z } from "zod";

import { confirmVillageDomain } from "@/lib/admin/settings-actions";
import { resolveAppUrl } from "@/lib/app-url";
import { createMemberRoute } from "@/lib/village/member-route";

const domainBodySchema = z.object({
  confirmed: z.literal(true, "Confirm that you added the domain."),
});

export const POST = createMemberRoute(
  "setup-domain",
  domainBodySchema,
  async (context) => {
    const domain = new URL(resolveAppUrl(context.environment)).hostname;
    await confirmVillageDomain(context, domain);
    return Response.json({ message: "Domain confirmed." });
  },
  { adminOnly: true },
);
