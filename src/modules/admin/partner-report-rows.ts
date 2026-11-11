import type { PartnerReport } from "./reads-partner-report.ts";

// The community's numbers today, for the end of the partner report's CSV. They aren't per period: a count of members
// or invites is a snapshot. Counts only.

export type ReportValue = number | string | null;

export type ReportRow = { label: string; note?: string; values: ReportValue[]; isStrong?: boolean };

export type ReportSection = { id: string; title: string; description: string; rows: ReportRow[] };

export function readCommunitySection({ community }: PartnerReport): ReportSection {
  const { members, sharing, synced, invites, windows, isNetworkOn, cohortMembers } = community;
  return {
    id: "community",
    title: "Community",
    description: "As of today. An active member posted, replied, reacted, sent a message or asked for an intro.",
    rows: [
      { label: "Members", values: [members], isStrong: true },
      ...cohortMembers.map(({ label, members: cohortCount }) => ({ label: `Members in ${label}`, values: [cohortCount] })),
      ...(isNetworkOn
        ? [
            { label: "Agreed to share their network", values: [sharing] },
            { label: "Network synced", values: [synced] },
          ]
        : []),
      { label: "Invites accepted", values: [invites.accepted], note: invites.acceptedPercent === null ? undefined : `${invites.acceptedPercent}% of invites sent.` },
      { label: "Invites still waiting", values: [invites.pending] },
      { label: "Invites expired", values: [invites.expired] },
      ...windows.map(({ days, activeMembers }) => ({ label: `Active members, last ${days} days`, values: [activeMembers] })),
      ...windows.map(({ days, posts }) => ({ label: `Posts, last ${days} days`, values: [posts] })),
    ],
  };
}
