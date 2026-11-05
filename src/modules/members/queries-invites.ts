import { queryOptions } from "@tanstack/react-query";

import { inviteListSchema, issuedInviteSchema, waitingMembersSchema, type InviteFilter } from "@/modules/members/contract-invites";
import { API_ROUTES } from "@/platform/http/routes";
import { acknowledgedResponseSchema } from "@/platform/http/contract";
import { postRequest } from "@/platform/http/post-request";

export const INVITE_QUERY_KEYS = { list: "invite-list", waiting: "members-waiting" } as const;

const INVITE_LIST_STALE_MS = 15_000;

export const waitingMembersQuery = queryOptions({
  queryKey: [INVITE_QUERY_KEYS.waiting],
  queryFn: () => postRequest(API_ROUTES.waitingMembers, {}, waitingMembersSchema),
  staleTime: INVITE_LIST_STALE_MS,
});

export function inviteListQuery(page: number, filter: InviteFilter) {
  return queryOptions({
    queryKey: [INVITE_QUERY_KEYS.list, filter, page],
    queryFn: () => postRequest(API_ROUTES.inviteList, { page, filter }, inviteListSchema),
    staleTime: INVITE_LIST_STALE_MS,
  });
}

export function createInviteRequest(email: string) {
  return postRequest(API_ROUTES.invites, { email }, issuedInviteSchema);
}

export function resendInviteRequest(inviteId: string) {
  return postRequest(API_ROUTES.inviteResend, { inviteId }, issuedInviteSchema);
}

export function revokeInviteRequest(inviteId: string) {
  return postRequest(API_ROUTES.inviteRevoke, { inviteId }, acknowledgedResponseSchema);
}

export function reclaimInviteRequest(inviteId: string) {
  return postRequest(API_ROUTES.inviteReclaim, { inviteId }, issuedInviteSchema);
}

export function confirmMemberRequest(memberId: string) {
  return postRequest(API_ROUTES.memberConfirm, { memberId }, acknowledgedResponseSchema);
}

export function confirmLinkedinRequest(memberId: string) {
  return postRequest(API_ROUTES.memberConfirmLinkedin, { memberId }, acknowledgedResponseSchema);
}

export function clearLinkedinRequest(linkedinUrl: string) {
  return postRequest(API_ROUTES.memberClearLinkedin, { linkedinUrl }, acknowledgedResponseSchema);
}
