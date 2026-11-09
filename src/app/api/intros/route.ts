import { emptyBodySchema } from "@/platform/http/contract";
import { enforceIntroLimit, INTRO_LIMIT_KINDS } from "@/modules/intros/limits";
import { readIntroBoard } from "@/modules/intros/reads";
import { sendDueOutcomeEmails } from "@/modules/intros/outcome-email";
import { introsRoutes } from "@/modules/intros/routes";
import { runAfterResponse } from "@/platform/observability/after-response";

export const POST = introsRoutes.member("intros-board", emptyBodySchema, async ({ database, member, environment }) => {
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.read);
  runAfterResponse(() => sendDueOutcomeEmails(database, environment));
  return Response.json(await readIntroBoard(database, member.id));
});
