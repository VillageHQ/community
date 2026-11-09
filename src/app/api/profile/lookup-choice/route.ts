import { lookupChoiceBodySchema } from "@/modules/members/contract-fill-in";
import { saveLookupChoice } from "@/modules/members/service-fill-in";
import { membersRoutes } from "@/modules/members/routes";

export const POST = membersRoutes.member("profile-lookup-choice", lookupChoiceBodySchema, async ({ database, member }, { allowsLookup }) => {
  await saveLookupChoice(database, member.id, allowsLookup);
  return Response.json({
    message: allowsLookup
      ? "Thanks. We'll fill in your card from public profiles, and you can hide any line."
      : "Done. We won't look you up, and anything filled in is gone.",
  });
});
