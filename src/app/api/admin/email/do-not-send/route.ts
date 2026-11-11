import { doNotSendRemoveBodySchema } from "@/modules/admin/contract-email";
import { adminRoutes } from "@/modules/admin/routes";
import { removeFromDoNotSend } from "@/modules/admin/service-email";

// Takes one address off the do-not-send list. Recorded in the audit log.
export const POST = adminRoutes.member(
  "admin-do-not-send-remove",
  doNotSendRemoveBodySchema,
  async (context, { email }) => {
    await removeFromDoNotSend(context, email);
    return Response.json({ message: `${email} can get optional email again.` });
  },
  { adminOnly: true },
);
