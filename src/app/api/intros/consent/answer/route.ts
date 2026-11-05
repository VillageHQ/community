import { consentAnswerBodySchema } from "@/modules/intros/contract";
import { introsRoutes } from "@/modules/intros/routes";
import { answerConsentAsk } from "@/modules/intros/service-consent";
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
      return respondWithError({ status: UNPROCESSABLE_STATUS, code: REQUEST_ERROR_CODES.invalidRequest, message: "This answer didn't come through. Try again." });
    }

    const viewer = await readSessionMember(request);
    try {
      return Response.json(await answerConsentAsk({ database: getDatabase(), environment: process.env, request, viewerId: viewer?.id ?? null }, body.data));
    } catch (error) {
      if (error instanceof RequestError) return respondWithError(error);
      throw error;
    }
  }),
);
