import { setMemberBlocked } from "@/modules/members/service-blocks";
import { setBlockBodySchema } from "@/modules/members/contract-blocks";
import { runMemberBlockedEffects } from "@/shell/member-effects";
import { membersRoutes } from "@/modules/members/routes";

export const POST = membersRoutes.member("messages-block", setBlockBodySchema, async (context, body) =>
  Response.json(await setMemberBlocked(context, body, runMemberBlockedEffects)),
);
