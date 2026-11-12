import { getDatabase } from "@/platform/database/client";
import { UNSUBSCRIBE_PAGE_FIELD, readUnsubscribeToken, setEmailTopic } from "@/platform/email/unsubscribe";
import { ROUTES } from "@/platform/http/routes";
import { platformRoutes } from "@/platform/modules/platform-routes";

const SEE_OTHER_STATUS = 303;
const BAD_REQUEST_STATUS = 400;
const FORM_TYPE = "application/x-www-form-urlencoded";

async function isFromUnsubscribePage(request: Request) {
  if (!request.headers.get("content-type")?.startsWith(FORM_TYPE)) return false;
  return (await request.formData()).has(UNSUBSCRIBE_PAGE_FIELD);
}

// The token is the only key: mail apps post here with no session and from no origin (RFC 8058).
// The page's own button posts a form here too, and goes back to the page to show the result.
export const POST = platformRoutes.open("email-unsubscribe", async (request: Request) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const database = getDatabase();
  const target = await readUnsubscribeToken(database, process.env, token);
  if (!target) return Response.json({ message: "This link isn't valid." }, { status: BAD_REQUEST_STATUS });

  await setEmailTopic(database, target, false);
  if (!(await isFromUnsubscribePage(request))) return Response.json({ unsubscribed: true });

  // Back by path: the server may see another address than the browser (127.0.0.1 against localhost, a proxy), and the
  // page's form-action 'self' rule would block a redirect there, so the page would seem to do nothing.
  const query = new URLSearchParams({ token });
  return new Response(null, { status: SEE_OTHER_STATUS, headers: { Location: `${ROUTES.unsubscribe}?${query}`, "Cache-Control": "no-store" } });
});
