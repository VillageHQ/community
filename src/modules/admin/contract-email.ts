import { z } from "zod";

// Admin › Email: the sent-email list shows who, what kind, how it went and when. Never a subject or body.
export const EMAIL_LOG_PAGE_SIZE = 100;

const MAXIMUM_ADDRESS_LENGTH = 320;

// Not checked as an email: the list holds whatever address the mail service reported, and each must be removable.
export const doNotSendRemoveBodySchema = z.object({ email: z.string().trim().toLowerCase().min(1, "Enter an email address.").max(MAXIMUM_ADDRESS_LENGTH) });
