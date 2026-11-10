import { deleteAccountBodySchema } from "@/modules/members/contract-privacy";
import { membersRoutes } from "@/modules/members/routes";
import { DELETION_ACTORS, deleteAccount } from "@/shell/account-deletion";

export const POST = membersRoutes.member("profile-delete", deleteAccountBodySchema, async (context) =>
  Response.json(await deleteAccount(context, context.member.id, DELETION_ACTORS.self)),
);
