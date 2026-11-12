import { z } from "zod";

import { getDatabase } from "@/platform/database/client";
import { MAXIMUM_JSON_BODY_BYTES, withBodyLimit } from "@/platform/http/body-limit";
import { readJsonBody } from "@/platform/http/read-json-body";
import { hasTrustedOrigin } from "@/platform/http/member-route";
import { NETWORK_ERROR_CODES } from "@/modules/network/contract";
import { INVITE_ERROR_CODES } from "@/modules/members/contract-invites";
import { reportNotMe } from "@/modules/members/service-invite-notice";
import { membersRoutes } from "@/modules/members/routes";

const OK_STATUS = 200;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;

const notMeBodySchema = z.object({ member: z.string().max(64), signature: z.string().max(128) });

// "It wasn't me", from the notice sent to an invited address after a join from its emailed link.
export const POST = membersRoutes.open(
  "invite-not-me",
  withBodyLimit(MAXIMUM_JSON_BODY_BYTES, async (request) => {
    if (!hasTrustedOrigin(request)) {
      return Response.json({ code: NETWORK_ERROR_CODES.forbiddenOrigin, message: "This request came from another site." }, { status: FORBIDDEN_STATUS });
    }
    const body = notMeBodySchema.safeParse(await readJsonBody(request));
    const isReported = body.success && (await reportNotMe(getDatabase(), process.env, body.data.member, body.data.signature));
    if (!isReported) {
      return Response.json(
        { code: INVITE_ERROR_CODES.invalidLink, message: "This link doesn't work anymore. If someone else joined with your invite, ask your admins for a new one." },
        { status: NOT_FOUND_STATUS },
      );
    }
    return Response.json({ isReported: true }, { status: OK_STATUS });
  }),
);
