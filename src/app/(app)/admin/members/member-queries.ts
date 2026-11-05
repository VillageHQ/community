import { queryOptions } from "@tanstack/react-query";

import { departureResponseSchema, memberPageSchema, type MemberFilter, type SetMemberRoleBody } from "@/lib/admin/admin-api";
import { issuedInviteSchema } from "@/lib/invites/invite-api";
import { API_ROUTES } from "@/lib/routes";
import { acknowledgedResponseSchema } from "@/lib/village/network-api";
import { postNetworkRequest } from "@/lib/village/post-network-request";

export const ADMIN_MEMBER_QUERY_KEYS = { list: "admin-member-list" } as const;

const MEMBER_LIST_STALE_MS = 15_000;

type MemberPageRequest = { search: string; filter: MemberFilter; page: number };

export function memberPageQuery({ search, filter, page }: MemberPageRequest) {
  return queryOptions({
    queryKey: [ADMIN_MEMBER_QUERY_KEYS.list, search, filter, page],
    queryFn: () => postNetworkRequest(API_ROUTES.memberList, { search, filter, page }, memberPageSchema),
    staleTime: MEMBER_LIST_STALE_MS,
  });
}

export function setMemberRoleRequest(body: SetMemberRoleBody) {
  return postNetworkRequest(API_ROUTES.memberRole, body, acknowledgedResponseSchema);
}

export function unbanMemberRequest(memberId: string) {
  return postNetworkRequest(API_ROUTES.memberUnban, { memberId }, acknowledgedResponseSchema);
}

export function approveVillageLinkRequest(memberId: string, villageEmail: string) {
  return postNetworkRequest(API_ROUTES.villageLinks, { memberId, villageEmail }, acknowledgedResponseSchema);
}

export function resetVillageLinkRequest(memberId: string) {
  return postNetworkRequest(API_ROUTES.villageLinkReset, { memberId, confirmed: true }, acknowledgedResponseSchema);
}

export function leaveGroupRequest(memberId: string) {
  return postNetworkRequest(API_ROUTES.memberLeaveGroup, { memberId }, departureResponseSchema);
}

export function reinviteMemberRequest(memberId: string) {
  return postNetworkRequest(API_ROUTES.memberReinvite, { memberId }, issuedInviteSchema);
}
