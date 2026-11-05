import { saveBrandingAsAdmin } from "@/lib/admin/settings-actions";
import { brandingBodySchema } from "@/platform/branding/branding-api";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "branding",
  brandingBodySchema,
  async (context, body) => {
    await saveBrandingAsAdmin(context, body);
    return Response.json({ message: "Brand saved." });
  },
  { adminOnly: true },
);
