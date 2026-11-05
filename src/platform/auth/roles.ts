import type { SessionMember } from "../http/request-context.ts";

export const MEMBER_ROLES = { admin: "admin", member: "user" } as const;

const ADMIN_ROLE = "admin";

export function isAdminMember(member: SessionMember) {
  return member.role === ADMIN_ROLE;
}
