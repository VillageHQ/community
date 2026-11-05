import { saveBrandingAsAdmin } from "@/lib/admin/settings-actions";
import { brandingBodySchema } from "@/lib/branding/branding-api";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute(
  "branding",
  brandingBodySchema,
  async (context, body) => {
    await saveBrandingAsAdmin(context, body);
    return Response.json({ message: "Brand saved." });
  },
  { adminOnly: true },
);
