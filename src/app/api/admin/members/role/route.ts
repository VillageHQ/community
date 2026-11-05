import { MEMBER_ROLES, setMemberRoleBodySchema } from "@/lib/admin/admin-api";
import { setMemberRole } from "@/lib/admin/member-roster";
import { logAdminAction } from "@/platform/observability/route-logging";
import { createMemberRoute } from "@/lib/village/member-route";

const ROLE_MESSAGES = {
  [MEMBER_ROLES.admin]: (name: string) => `${name} is now an admin.`,
  [MEMBER_ROLES.member]: (name: string) => `${name} is no longer an admin.`,
};

export const POST = createMemberRoute(
  "admin-member-role",
  setMemberRoleBodySchema,
  async (context, body) => {
    const name = await setMemberRole(context, body);
    logAdminAction(`member_role_${body.role}`, context.member.id, body.memberId);
    return Response.json({ message: ROLE_MESSAGES[body.role](name) });
  },
  { adminOnly: true },
);
