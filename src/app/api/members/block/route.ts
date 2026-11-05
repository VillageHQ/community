import { setMemberBlocked } from "@/modules/members/service-blocks";
import { setBlockBodySchema } from "@/modules/members/contract-blocks";
import { stopOpenAsksOnBlock } from "@/modules/intros/service-blocks";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute("messages-block", setBlockBodySchema, async (context, body) =>
  Response.json(await setMemberBlocked(context, body, stopOpenAsksOnBlock)),
);
