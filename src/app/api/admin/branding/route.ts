import { saveBranding } from "@/lib/branding/branding";
import { brandingBodySchema } from "@/lib/branding/branding-api";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute(
  "branding",
  brandingBodySchema,
  async (context, body) => {
    await saveBranding(context.database, body);
    return Response.json({ message: "Brand saved." });
  },
  { adminOnly: true },
);
