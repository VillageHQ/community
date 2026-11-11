import { z } from "zod";

import { API_ROUTES } from "../../platform/http/routes.ts";

// Set up › Mail: the DNS settings form. Empty means "use the default" (the resend selector; reply. on the domain).
export const MAIL_SETTINGS_API_ROUTE = `${API_ROUTES.adminEmail}/settings`;

const DOMAIN_SHAPE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const SELECTOR_SHAPE = /^[a-z0-9](?:[a-z0-9._-]{0,61}[a-z0-9])?$/;

export const mailSettingsBodySchema = z.object({
  dkimSelector: z
    .string()
    .trim()
    .toLowerCase()
    .max(63, "Keep the DKIM selector under 63 characters.")
    .refine((text) => text === "" || SELECTOR_SHAPE.test(text), "Use the selector as your mail service shows it, like resend."),
  replyDomain: z
    .string()
    .trim()
    .toLowerCase()
    .max(120, "Keep the reply subdomain under 120 characters.")
    .refine((text) => text === "" || DOMAIN_SHAPE.test(text), "Use a domain like reply.fund.example."),
});

export type MailSettingsBody = z.infer<typeof mailSettingsBodySchema>;
