import { adminRoutes } from "@/modules/admin/routes";
import { adminDeleteAccountBodySchema } from "@/modules/members/contract-privacy";
import { logAdminAction } from "@/platform/observability/route-logging";
import { DELETION_ACTORS, deleteAccount } from "@/shell/account-deletion";

export const POST = adminRoutes.member(
  "admin-member-delete",
  adminDeleteAccountBodySchema,
  async (context, { memberId }) => {
    const deleted = await deleteAccount(context, memberId, DELETION_ACTORS.admin);
    logAdminAction("account_deleted", context.member.id, memberId);
    return Response.json(deleted);
  },
  { adminOnly: true },
);
