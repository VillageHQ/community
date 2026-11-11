import { adminRoutes } from "@/modules/admin/routes";
import { checkMailDns } from "@/modules/admin/service-mail";
import { emptyBodySchema } from "@/platform/http/contract";

const CONFLICT_STATUS = 409;

// Set up › Mail › Check DNS now: live lookups for SPF, DKIM, DMARC and the reply MX. Reads DNS only, never changes a
// record; the result is kept so Settings' mail checklist shows it, and the check is written to the audit log.
export const POST = adminRoutes.member(
  "admin-email-check",
  emptyBodySchema,
  async (context) => {
    const check = await checkMailDns(context);
    if (!check) return Response.json({ message: "No sending domain yet. Set one in Settings, or add your Resend settings on your host." }, { status: CONFLICT_STATUS });
    return Response.json(check);
  },
  { adminOnly: true },
);
