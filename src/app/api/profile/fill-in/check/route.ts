import { FACT_ANSWERS, factAnswerBodySchema } from "@/modules/members/contract-fill-in";
import { confirmFillInLine, fixFillInLine, setFillInHidden } from "@/modules/members/service-fill-in";
import { membersRoutes } from "@/modules/members/routes";

const NOT_FOUND_STATUS = 404;
const UNPROCESSABLE_STATUS = 422;

// Today's "Is this right?": Right, Hide it, or Fix it in the member's own words.
export const POST = membersRoutes.member("profile-fill-in-check", factAnswerBodySchema, async ({ database, member }, { field, answer, value }) => {
  if (answer === FACT_ANSWERS.fix) {
    if (!value) return Response.json({ code: "empty", message: "Write your own words first." }, { status: UNPROCESSABLE_STATUS });
    await fixFillInLine(database, member.id, field, value);
    return Response.json({ message: "Saved in your own words." });
  }
  const isDone = answer === FACT_ANSWERS.right ? await confirmFillInLine(database, member.id, field) : await setFillInHidden(database, member.id, field, true);
  if (!isDone) return Response.json({ code: "not_found", message: "That line isn't on your card anymore." }, { status: NOT_FOUND_STATUS });
  return Response.json({ message: "Done." });
});
