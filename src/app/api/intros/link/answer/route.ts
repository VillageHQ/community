import { linkAnswerBodySchema } from "@/modules/intros/contract";
import { introsRoutes } from "@/modules/intros/routes";
import { answerByLink } from "@/modules/intros/service-answers";
import { getDatabase } from "@/platform/database/client";
import { MAXIMUM_JSON_BODY_BYTES, withBodyLimit } from "@/platform/http/body-limit";
import { REQUEST_ERROR_CODES } from "@/platform/http/error-codes";
import { hasTrustedOrigin, respondWithError } from "@/platform/http/member-route";
import { readJsonBody } from "@/platform/http/read-json-body";
import { RequestError } from "@/platform/http/request-error";

const FORBIDDEN_STATUS = 403;
const UNPROCESSABLE_STATUS = 422;

// A connector's answer or an asker's outcome, from the link in their email: no sign-in, the token is the key.
export const POST = introsRoutes.open(
  "intros-link-answer",
  withBodyLimit(MAXIMUM_JSON_BODY_BYTES, async (request) => {
    if (!hasTrustedOrigin(request)) {
      return respondWithError({ status: FORBIDDEN_STATUS, code: REQUEST_ERROR_CODES.forbiddenOrigin, message: "This request came from another site." });
    }
    const body = linkAnswerBodySchema.safeParse(await readJsonBody(request));
    if (!body.success) return respondWithError({ status: UNPROCESSABLE_STATUS, code: REQUEST_ERROR_CODES.invalidRequest, message: "Pick an answer." });
    try {
      return Response.json(await answerByLink({ database: getDatabase(), environment: process.env, request }, body.data));
    } catch (error) {
      if (error instanceof RequestError) return respondWithError(error);
      throw error;
    }
  }),
);
