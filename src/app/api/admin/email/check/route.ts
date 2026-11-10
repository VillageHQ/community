import { adminRoutes } from "@/modules/admin/routes";
import { checkSendingDomain, readSendingDomain } from "@/platform/email/dns-check";
import { readResendConfig } from "@/platform/email/resend";
import { emptyBodySchema } from "@/platform/http/contract";

const CONFLICT_STATUS = 409;

// Live DNS lookups for the sending domain. Reads only: it never changes a record.
export const POST = adminRoutes.member(
  "admin-email-check",
  emptyBodySchema,
  async ({ environment }) => {
    const config = readResendConfig(environment);
    if (!config) return Response.json({ message: "Email is off. Add your Resend settings on your host first." }, { status: CONFLICT_STATUS });
    const domain = readSendingDomain(config.fromAddress);
    if (!domain) return Response.json({ message: `We can't read a domain in ${config.fromAddress}. Use a sender like Northwind <hello@example.com>.` }, { status: CONFLICT_STATUS });
    return Response.json(await checkSendingDomain(domain));
  },
  { adminOnly: true },
);
