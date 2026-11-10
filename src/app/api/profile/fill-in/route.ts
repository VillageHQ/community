import { fillInVisibilityBodySchema } from "@/modules/members/contract-fill-in";
import { setFillInHidden } from "@/modules/members/service-fill-in";
import { membersRoutes } from "@/modules/members/routes";

const NOT_FOUND_STATUS = 404;

export const POST = membersRoutes.member("profile-fill-in-visibility", fillInVisibilityBodySchema, async ({ database, member }, { field, isHidden }) => {
  if (!(await setFillInHidden(database, member.id, field, isHidden))) {
    return Response.json({ code: "not_found", message: "That line isn't on your card anymore." }, { status: NOT_FOUND_STATUS });
  }
  return Response.json({ message: isHidden ? "Hidden. It stays hidden when your card is refreshed." : "Shown on your card again." });
});
