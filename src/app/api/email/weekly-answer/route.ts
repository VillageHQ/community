import { getDatabase } from "@/platform/database/client";
import { ROUTES } from "@/platform/http/routes";
import { platformRoutes } from "@/platform/modules/platform-routes";
import { WEEKLY_ANSWER_WORDS_FIELD } from "@/platform/weekly-email/ledger";
import { answerFromLink } from "@/shell/weekly-email-answers";

const SEE_OTHER_STATUS = 303;
const BAD_REQUEST_STATUS = 400;
const FORM_TYPE = "application/x-www-form-urlencoded";
const MAXIMUM_WORDS_LENGTH = 2_000;

// The signed token is the only key, as with unsubscribe: the person may not be signed in on this
// device. Only this POST acts. The confirm page's button posts here, then goes back to show the result.
export const POST = platformRoutes.open("weekly-answer", async (request: Request) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const isForm = request.headers.get("content-type")?.startsWith(FORM_TYPE) ?? false;
  const words = isForm ? String((await request.formData()).get(WEEKLY_ANSWER_WORDS_FIELD) ?? "").slice(0, MAXIMUM_WORDS_LENGTH) : "";

  const result = await answerFromLink(getDatabase(), process.env, token, words);
  if (!result) return Response.json({ message: "This link isn't valid." }, { status: BAD_REQUEST_STATUS });
  if (!isForm) return Response.json(result);

  // Back by path, never by this request's own address: behind a proxy, or on 127.0.0.1 against localhost, the server
  // may see another address than the browser, and the page's form-action 'self' rule would block that redirect.
  const query = new URLSearchParams({ token, result: result.outcome });
  return new Response(null, { status: SEE_OTHER_STATUS, headers: { Location: `${ROUTES.weeklyAnswer}?${query}`, "Cache-Control": "no-store" } });
});
