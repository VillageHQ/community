import { INVITE_LIFETIME_DAYS } from "./contract-invite-state.ts";

// The invite email's words (Founderhall's, word for word): the email itself and the preview on Admin › Invites
// both read them, so the preview is the email that goes out.

// "Northwind Founders’" / "Ada’s".
export function toPossessive(name: string, apostrophe = "’") {
  const trimmed = name.trim();
  return /s$/i.test(trimmed) ? `${trimmed}${apostrophe}` : `${trimmed}${apostrophe}s`;
}

function readFirstWord(name: string | null | undefined) {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

type InviteWordsFacts = { community: string; inviteeName?: string | null; inviterName?: string | null; inviterRole?: string | null; apostrophe?: string };

export function readInviteWords({ community, inviteeName, inviterName, inviterRole, apostrophe = "’" }: InviteWordsFacts) {
  const inviter = (inviterName ?? "").trim();
  const firstName = readFirstWord(inviteeName);
  return {
    subject: `Your place in ${community}`,
    hi: firstName ? `Hi ${firstName},` : "Hi,",
    lead: `${inviter ? `${inviter} invited you` : "You are invited"} to ${community}: see who in ${toPossessive(community, apostrophe)} circle can introduce you, and ask in one tap. Nobody is introduced without saying yes.`,
    how: "Open this link to sign in. It answers two questions about you, then you are in",
    button: `Sign in to ${community}`,
    small: `The link works once and lasts ${INVITE_LIFETIME_DAYS} days.`,
    sign: inviter ? [inviter, (inviterRole ?? "").trim(), community].filter(Boolean).join(", ") : `The ${community} team`,
    ignore: "If you did not expect this, ignore this email and nothing more is sent.",
    footer: `Sent by ${community} via its member portal.`,
  };
}
