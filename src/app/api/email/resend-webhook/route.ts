import { getDatabase } from "@/platform/database/client";
import { isReceivedEmailEvent, readReceivedEmailEvent } from "@/platform/email/inbound";
import { isResendWebhookSigned, readResendWebhookSecret, readSuppressedAddresses, suppressEmails } from "@/platform/email/resend-webhook";
import { platformRoutes } from "@/platform/modules/platform-routes";
import { answerFromReply } from "@/shell/weekly-email-answers";

const MAXIMUM_BODY_BYTES = 64 * 1024;
const UNAUTHORIZED_STATUS = 401;
const NOT_FOUND_STATUS = 404;
const PAYLOAD_TOO_LARGE_STATUS = 413;
const UNPROCESSABLE_STATUS = 422;

// Resend calls this when an email bounces or the reader marks it as spam. Those addresses go on
// the do-not-send list, so optional email stops going to them. It also calls it when a reply to a
// weekly email arrives, and the codes in that reply answer its items.
export const POST = platformRoutes.open("resend-webhook", async (request: Request) => {
  const secret = readResendWebhookSecret(process.env);
  if (!secret) return Response.json({ message: "Set RESEND_WEBHOOK_SECRET to turn this on." }, { status: NOT_FOUND_STATUS });

  if (Number(request.headers.get("content-length") ?? 0) > MAXIMUM_BODY_BYTES) {
    return Response.json({ message: "Too large." }, { status: PAYLOAD_TOO_LARGE_STATUS });
  }
  const body = await request.text();
  if (Buffer.byteLength(body) > MAXIMUM_BODY_BYTES) return Response.json({ message: "Too large." }, { status: PAYLOAD_TOO_LARGE_STATUS });
  const signed = {
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    body,
  };
  if (!isResendWebhookSigned(secret, signed)) return Response.json({ message: "The signature doesn't match." }, { status: UNAUTHORIZED_STATUS });

  if (isReceivedEmailEvent(body)) {
    const received = readReceivedEmailEvent(body);
    if (!received) return Response.json({ message: "This isn't a Resend event." }, { status: UNPROCESSABLE_STATUS });
    return Response.json(await answerFromReply(getDatabase(), process.env, received));
  }
  const event = readSuppressedAddresses(body);
  if (!event) return Response.json({ message: "This isn't a Resend event." }, { status: UNPROCESSABLE_STATUS });
  if (event.reason) await suppressEmails(getDatabase(), event.emails, event.reason);
  return Response.json({ received: true });
});
