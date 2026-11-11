import { z } from "zod";

// Admin › Email: the sent-email list shows who, what kind, how it went and when. Never a subject or body.
export const EMAIL_LOG_PAGE_SIZE = 100;

export const doNotSendRemoveBodySchema = z.object({ email: z.string().trim().toLowerCase().email("Enter an email address.") });
