// The flash an Invites page shows after an action, carried in its address (?m=resent), Founderhall's way.
export const INVITE_FLASH_PARAM = "m";

export const INVITE_FLASHES = {
  resent: "Invite sent again. The old link no longer works.",
  revoked: "Invite revoked. Its link no longer works.",
} as const;

export type InviteFlash = keyof typeof INVITE_FLASHES;

export function readInviteFlash(value: unknown) {
  return typeof value === "string" && value in INVITE_FLASHES ? INVITE_FLASHES[value as InviteFlash] : null;
}
