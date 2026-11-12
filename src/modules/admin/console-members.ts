// The console's Members table (Founderhall's /admin/members): one list of everyone, members and the people invited
// who haven't signed in yet, with Founderhall's filters, statuses and search. Pure, so the page and tests share it.

export const CONSOLE_MEMBER_FILTERS = {
  all: "all",
  invited: "invited",
  joined: "joined",
  connected: "connected",
  admins: "admins",
  delete: "delete",
  // Community-only, shown as chips only while they hold someone.
  attention: "attention",
  removed: "removed",
} as const;

export type ConsoleMemberFilter = (typeof CONSOLE_MEMBER_FILTERS)[keyof typeof CONSOLE_MEMBER_FILTERS];

export const CONSOLE_MEMBER_FILTER_LABELS: Record<ConsoleMemberFilter, string> = {
  all: "All",
  invited: "Invited",
  joined: "Joined",
  connected: "Connected",
  admins: "Admins",
  delete: "Asked to delete",
  attention: "Needs a look",
  removed: "Removed",
};

// Founderhall's six chips, always shown; then Community's own, only while they hold someone.
export const ALWAYS_SHOWN_FILTERS: readonly ConsoleMemberFilter[] = ["all", "invited", "joined", "connected", "admins", "delete"];
export const SHOWN_WHEN_FULL_FILTERS: readonly ConsoleMemberFilter[] = ["attention", "removed"];

export function parseConsoleMemberFilter(value: unknown): ConsoleMemberFilter {
  return typeof value === "string" && value in CONSOLE_MEMBER_FILTERS ? (value as ConsoleMemberFilter) : CONSOLE_MEMBER_FILTERS.all;
}

export const CONSOLE_MEMBER_STATES = { invited: "invited", joined: "joined", connected: "connected", removed: "removed" } as const;

export type ConsoleMemberState = (typeof CONSOLE_MEMBER_STATES)[keyof typeof CONSOLE_MEMBER_STATES];

export type ConsoleMember = {
  // A member's id, or the invite's id for someone invited.
  id: string;
  kind: "member" | "invite";
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  title: string | null;
  company: string | null;
  companyLogoUrl: string | null;
  location: string | null;
  // More words a search finds (an invited person's company from the invite list).
  searchExtra?: string | null;
  state: ConsoleMemberState;
  // Joined, or invited: the date in the "When" column.
  since: string;
  isNeedsLook: boolean;
  // When the member asked to be deleted (none in Community today: members delete their own account from Your data).
  deleteRequestedAt: string | null;
};

const MATCHES: Record<ConsoleMemberFilter, (member: ConsoleMember) => boolean> = {
  all: (member) => member.state !== CONSOLE_MEMBER_STATES.removed,
  invited: (member) => member.state === CONSOLE_MEMBER_STATES.invited,
  joined: (member) => member.state === CONSOLE_MEMBER_STATES.joined,
  connected: (member) => member.state === CONSOLE_MEMBER_STATES.connected,
  admins: (member) => member.isAdmin && member.state !== CONSOLE_MEMBER_STATES.removed,
  delete: (member) => member.deleteRequestedAt !== null,
  attention: (member) => member.isNeedsLook,
  removed: (member) => member.state === CONSOLE_MEMBER_STATES.removed,
};

export function matchesConsoleFilter(member: ConsoleMember, filter: ConsoleMemberFilter) {
  return MATCHES[filter](member);
}

// "Name, email, company or city".
export function matchesConsoleSearch(member: ConsoleMember, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [member.name, member.email, member.title, member.company, member.location, member.searchExtra].some((value) => value?.toLowerCase().includes(query));
}

export function countConsoleMembers(members: readonly ConsoleMember[]): Record<ConsoleMemberFilter, number> {
  const filters = Object.values(CONSOLE_MEMBER_FILTERS);
  return Object.fromEntries(filters.map((filter) => [filter, members.filter((member) => MATCHES[filter](member)).length])) as Record<ConsoleMemberFilter, number>;
}

// Founderhall's order: members by name first, then the people invited, newest invite first.
export function sortConsoleMembers(members: readonly ConsoleMember[]) {
  const joined = members.filter(({ kind }) => kind === "member").sort((first, second) => (first.name ?? "").localeCompare(second.name ?? ""));
  const invited = members.filter(({ kind }) => kind === "invite").sort((first, second) => second.since.localeCompare(first.since));
  return [...joined, ...invited];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "26 Sep", in UTC like the rest of the console.
export function formatShortDate(iso: string) {
  const date = new Date(iso);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

// "joined 26 Sep" / "invited 10 Nov".
export function readWhen(member: ConsoleMember) {
  return `${member.state === CONSOLE_MEMBER_STATES.invited ? "invited" : "joined"} ${formatShortDate(member.since)}`;
}

// The "Role and company" cell: "Founder, Gridwise"; null when the member has neither.
export function readRoleAndCompany({ title, company }: Pick<ConsoleMember, "title" | "company">) {
  const line = [title, company].filter(Boolean).join(", ");
  return line || null;
}

export const STATUS_PILLS: Record<ConsoleMemberState, { tone: "made" | "open" | "declined"; label: string }> = {
  invited: { tone: "open", label: "Invited" },
  joined: { tone: "made", label: "Joined" },
  connected: { tone: "made", label: "Connected" },
  removed: { tone: "declined", label: "Removed" },
};

export const MEMBERS_LEGEND = "Invited: the invite went out, they haven’t signed in. Joined: signed in. Connected: joined and connected their network through Village.";
