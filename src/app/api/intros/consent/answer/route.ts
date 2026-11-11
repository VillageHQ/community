import { CONSENT_ANSWERS, consentAnswerBodySchema } from "@/modules/intros/contract";
import { introsRoutes } from "@/modules/intros/routes";
import { answerConsentAsk, stopIntroAsks } from "@/modules/intros/service-consent";
import { getDatabase } from "@/platform/database/client";
import { MAXIMUM_JSON_BODY_BYTES, withBodyLimit } from "@/platform/http/body-limit";
import { REQUEST_ERROR_CODES } from "@/platform/http/error-codes";
import { hasTrustedOrigin, readSessionMember, respondWithError } from "@/platform/http/member-route";
import { readJsonBody } from "@/platform/http/read-json-body";
import { RequestError } from "@/platform/http/request-error";

const FORBIDDEN_STATUS = 403;
const UNPROCESSABLE_STATUS = 422;

export const POST = introsRoutes.open(
  "intros-consent-answer",
  withBodyLimit(MAXIMUM_JSON_BODY_BYTES, async (request) => {
    if (!hasTrustedOrigin(request)) {
      return respondWithError({ status: FORBIDDEN_STATUS, code: REQUEST_ERROR_CODES.forbiddenOrigin, message: "This request came from another site." });
    }
    const body = consentAnswerBodySchema.safeParse(await readJsonBody(request));
    if (!body.success) {
      // A bad address gets its own words, so the person fixes it instead of retrying the same one.
      const emailIssue = body.error.issues.find(({ path }) => path[0] === "targetEmail");
      const message = emailIssue ? emailIssue.message : "This answer didn't come through. Try again.";
      return respondWithError({ status: UNPROCESSABLE_STATUS, code: REQUEST_ERROR_CODES.invalidRequest, message });
    }

    const viewer = await readSessionMember(request);
    try {
      const context = { database: getDatabase(), environment: process.env, request, viewerId: viewer?.id ?? null };
      // "Don't send me intro asks" works from a closed link too (the opt-out page).
      if (body.data.answer === CONSENT_ANSWERS.stopAllAsks) return Response.json(await stopIntroAsks(context, body.data.token));
      return Response.json(await answerConsentAsk(context, body.data));
    } catch (error) {
      if (error instanceof RequestError) return respondWithError(error);
      throw error;
    }
  }),
);
