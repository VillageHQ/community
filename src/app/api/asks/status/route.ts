import { askStatusBodySchema } from "@/modules/asks/contract";
import { asksRoutes } from "@/modules/asks/routes";
import { setAskStatus } from "@/modules/asks/service-status";
import { isAdminMember } from "@/platform/auth/roles";

export const POST = asksRoutes.member("asks-status", askStatusBodySchema, async (context, body) => {
  await setAskStatus(context, body, isAdminMember(context.member));
  return Response.json({ message: "Done." });
});
