import { adminRoutes } from "@/modules/admin/routes";
import { checkSettings, settingsBodySchema } from "@/modules/admin/contract-settings";
import { saveCommunitySettings } from "@/modules/admin/service-settings";

// Set up › Settings: one save for the whole page. A field that needs a fix stops the save and comes back by name.
export const POST = adminRoutes.member(
  "admin-settings",
  settingsBodySchema,
  async (context, body) => {
    const { values, errors } = checkSettings(body);
    if (Object.keys(errors).length > 0) return Response.json({ saved: false, errors });
    await saveCommunitySettings(context, values);
    return Response.json({ saved: true, errors: {} });
  },
  { adminOnly: true },
);
