import { queryOptions } from "@tanstack/react-query";

import { inviteListSchema, issuedInviteSchema, waitingMembersSchema, type InviteFilter } from "@/modules/members/contract-invites";
import { bulkInviteResultSchema, type BulkInviteFormat } from "@/modules/members/contract-bulk-invites";
import { API_ROUTES } from "@/platform/http/routes";
import { readResponseMessage } from "@/platform/http/read-response-message";
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

export function createInviteRequest({ email, cohort }: { email: string; cohort: string }) {
  return postRequest(API_ROUTES.invites, { email, cohort }, issuedInviteSchema);
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

const BULK_FAILURE_MESSAGE = "We couldn't read that list. Try again.";

export async function createBulkInvitesRequest(format: BulkInviteFormat, body: string | Blob) {
  let response: Response;
  try {
    response = await fetch(`${API_ROUTES.inviteBulk}?format=${format}`, { method: "POST", headers: { "Content-Type": "text/plain; charset=utf-8" }, body });
  } catch {
    throw new Error("We couldn't reach the server. Check your connection and try again.");
  }
  if (!response.ok) throw new Error(await readResponseMessage(response, BULK_FAILURE_MESSAGE));
  return bulkInviteResultSchema.parse(await response.json());
}
