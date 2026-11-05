import { saveBrandingAsAdmin } from "@/platform/branding/admin-actions";
import { brandingBodySchema } from "@/platform/branding/branding-api";
import { adminRoutes } from "@/modules/admin/routes";

export const POST = adminRoutes.member(
  "branding",
  brandingBodySchema,
  async (context, body) => {
    await saveBrandingAsAdmin(context, body);
    return Response.json({ message: "Brand saved." });
  },
  { adminOnly: true },
);
