import { z } from "zod";

import { resolveAppUrl } from "@/lib/app-url";
import { createMemberRoute } from "@/lib/village/member-route";
import { saveConfirmedVillageDomain } from "@/lib/village/settings";

const domainBodySchema = z.object({
  confirmed: z.literal(true, "Confirm that you added the domain."),
});

export const POST = createMemberRoute(
  "setup-domain",
  domainBodySchema,
  async (context) => {
    const domain = new URL(resolveAppUrl(context.environment)).hostname;
    await saveConfirmedVillageDomain(context.database, domain);
    return Response.json({ message: "Domain confirmed." });
  },
  { adminOnly: true },
);
