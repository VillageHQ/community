import { mailSettingsBodySchema } from "@/modules/admin/contract-mail";
import { adminRoutes } from "@/modules/admin/routes";
import { saveMailSettings } from "@/modules/admin/service-mail";

// Set up › Mail › DNS settings: the DKIM selector and the reply subdomain the DNS check looks up.
export const POST = adminRoutes.member(
  "admin-email-settings",
  mailSettingsBodySchema,
  async (context, body) => {
    await saveMailSettings(context, body);
    return Response.json({ message: "Saved." });
  },
  { adminOnly: true },
);
