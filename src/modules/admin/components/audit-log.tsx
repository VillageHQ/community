"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";

import { Pagination } from "@/components/pagination";
import { QueryBoundary } from "@/components/query-boundary";
import { QuoteBox } from "@/components/ui/note";
import { AUDIT_ACTIONS, type AuditAction } from "@/platform/audit/actions";
import { AUDIT_KINDS, REPORT_TARGETS, type AuditEntry } from "@/modules/admin/contract";
import { GROUP_DEPARTURE_OUTCOMES } from "@/modules/network/contract";
import { formatDayMonthTimeUtc } from "@/platform/text/format-date";

import { auditPageQuery } from "@/modules/admin/queries-audit";

// Founderhall's audit log (copy admin-audit): one ruled row per entry, the action in words with its target after a
// dot, who did it under it, and the UTC time on the right. Newest first.
const AUDIT_TITLE_ID = "audit-log-title";
const FORMER_ADMIN = "A former admin";

const REPORT_TARGET_NAMES: Record<string, string> = {
  [REPORT_TARGETS.post]: "post",
  [REPORT_TARGETS.comment]: "reply",
  [REPORT_TARGETS.directMessage]: "direct message",
  [REPORT_TARGETS.introNote]: "intro note",
  [REPORT_TARGETS.ask]: "ask",
  [REPORT_TARGETS.askAnswer]: "answer on an ask",
};

const GROUP_DEPARTURE_WORDS: Record<string, string> = {
  [GROUP_DEPARTURE_OUTCOMES.left]: "Taken out of the Village group",
  [GROUP_DEPARTURE_OUTCOMES.creatorRefused]: "Not taken out of the Village group: Village refused, because they created it",
  [GROUP_DEPARTURE_OUTCOMES.failed]: "Not taken out of the Village group: it didn't work",
};

type ActionFacts = { target: string | null; detail: string };
// The action in words, and what it was done to (a person, an ask, an address), shown after a dot.
type ActionLine = { words: string; target?: string | null };

const quoted = (text: string) => (text ? `“${text}”` : null);
const reportedThing = (detail: string) => REPORT_TARGET_NAMES[detail] ?? "message";

// In Founderhall's voice (its audit words where the action is the same). An action without words shows its id, as
// Founderhall does.
const ACTION_LINES: Partial<Record<AuditAction, (facts: ActionFacts) => ActionLine>> = {
  [AUDIT_ACTIONS.rolePromoted]: ({ target }) => ({ words: "Made an admin", target }),
  [AUDIT_ACTIONS.roleDemoted]: ({ target }) => ({ words: "No longer an admin", target }),
  [AUDIT_ACTIONS.memberRemoved]: ({ target, detail }) => ({ words: detail ? `Removed from the community. ${detail}` : "Removed from the community", target }),
  [AUDIT_ACTIONS.memberUnbanned]: ({ target }) => ({ words: "Let back in", target }),
  [AUDIT_ACTIONS.emailConfirmed]: ({ target }) => ({ words: "Email approved", target }),
  [AUDIT_ACTIONS.villageLinkApproved]: ({ target, detail }) => ({ words: `Village account approved: ${detail}`, target }),
  [AUDIT_ACTIONS.villageLinkReset]: ({ target }) => ({ words: "Village link reset", target }),
  [AUDIT_ACTIONS.linkedinConfirmed]: ({ target }) => ({ words: "LinkedIn confirmed", target }),
  [AUDIT_ACTIONS.linkedinCleared]: ({ target }) => ({ words: "LinkedIn cleared", target }),
  [AUDIT_ACTIONS.inviteCreated]: ({ target }) => ({ words: "Invited", target }),
  [AUDIT_ACTIONS.inviteResent]: ({ target }) => ({ words: "Invite resent", target }),
  [AUDIT_ACTIONS.inviteRevoked]: ({ target }) => ({ words: "Invite revoked", target }),
  [AUDIT_ACTIONS.inviteReclaimed]: ({ target, detail }) => ({ words: `Account locked and a new invite made for ${detail}`, target }),
  [AUDIT_ACTIONS.reportDismissed]: ({ target, detail }) => ({ words: `Dismissed a report on a ${reportedThing(detail)}`, target }),
  [AUDIT_ACTIONS.reportedContentDeleted]: ({ target, detail }) => ({ words: `Deleted a reported ${reportedThing(detail)}`, target }),
  [AUDIT_ACTIONS.postPinned]: ({ target }) => ({ words: "Pinned a post", target }),
  [AUDIT_ACTIONS.postUnpinned]: ({ target }) => ({ words: "Unpinned a post", target }),
  [AUDIT_ACTIONS.dailyLimitChanged]: ({ detail }) => ({ words: `Changed settings: ${detail} lookups a member can use a day` }),
  [AUDIT_ACTIONS.villageKeysSaved]: () => ({ words: "Changed settings: Village keys" }),
  [AUDIT_ACTIONS.villageGroupCreated]: ({ detail }) => ({ words: "Created the Village group", target: quoted(detail) }),
  [AUDIT_ACTIONS.brandingSaved]: () => ({ words: "Changed settings: branding" }),
  [AUDIT_ACTIONS.dataHomeSaved]: () => ({ words: "Changed settings: hosting & data" }),
  [AUDIT_ACTIONS.emailUnsuppressed]: ({ detail }) => ({ words: "Taken off the do-not-send list", target: detail || null }),
  [AUDIT_ACTIONS.logoSaved]: () => ({ words: "Changed settings: logo" }),
  [AUDIT_ACTIONS.logoRemoved]: () => ({ words: "Removed the logo" }),
  [AUDIT_ACTIONS.villageGroupLeft]: ({ target, detail }) => ({ words: GROUP_DEPARTURE_WORDS[detail] ?? "Not taken out of the Village group", target }),
  [AUDIT_ACTIONS.memberReinvited]: ({ target, detail }) => ({ words: `Invited back as a new account, at ${detail}`, target }),
  [AUDIT_ACTIONS.passwordReset]: () => ({ words: "Reset their password by email" }),
  [AUDIT_ACTIONS.adminPasswordRecovered]: () => ({ words: "Recovered their admin password with the setup token" }),
  [AUDIT_ACTIONS.moduleTurnedOn]: ({ detail }) => ({ words: "Turned on", target: detail }),
  [AUDIT_ACTIONS.moduleTurnedOff]: ({ detail }) => ({ words: "Turned off", target: detail }),
  [AUDIT_ACTIONS.askRemoved]: ({ target, detail }) => ({ words: `Removed an ask by ${target ?? "a member"}`, target: quoted(detail) }),
  [AUDIT_ACTIONS.askAnswerRemoved]: ({ target, detail }) => ({ words: `Removed an answer by ${target ?? "a member"}`, target: quoted(detail) }),
  [AUDIT_ACTIONS.askAllowanceChanged]: ({ detail }) => ({ words: `Changed settings: ${detail} asks a member a week` }),
  [AUDIT_ACTIONS.introOutcomeDaysChanged]: ({ detail }) => ({ words: `Changed settings: the outcome question ${detail} days after each intro` }),
  [AUDIT_ACTIONS.askPinned]: ({ target, detail }) => ({ words: `Pinned an ask by ${target ?? "a member"}`, target: quoted(detail) }),
  [AUDIT_ACTIONS.askUnpinned]: ({ target, detail }) => ({ words: `Unpinned an ask by ${target ?? "a member"}`, target: quoted(detail) }),
  [AUDIT_ACTIONS.askReopened]: ({ target, detail }) => ({ words: `Reopened an ask by ${target ?? "a member"}`, target: quoted(detail) }),
  [AUDIT_ACTIONS.askClosedByAdmin]: ({ target, detail }) => ({ words: `Closed an ask by ${target ?? "a member"}`, target: quoted(detail) }),
  [AUDIT_ACTIONS.domainConfirmed]: ({ detail }) => ({ words: "Confirmed the domain in Village", target: detail }),
  [AUDIT_ACTIONS.introAsksStopped]: () => ({ words: "Asked not to get intro asks" }),
  [AUDIT_ACTIONS.fillInBasisChanged]: ({ detail }) => ({ words: readFillInBasisWords(detail) }),
  [AUDIT_ACTIONS.fillInRunStarted]: () => ({ words: "Filled in profiles now" }),
  [AUDIT_ACTIONS.monthlyCapChanged]: ({ detail }) => ({ words: `Changed settings: ${detail} lookups a month (limit)` }),
  [AUDIT_ACTIONS.connectNudgeSent]: ({ detail }) => ({ words: "Nudged members to connect their network", target: detail }),
  [AUDIT_ACTIONS.partnerReportSent]: ({ detail }) => ({ words: "Sent the partner report", target: detail }),
  [AUDIT_ACTIONS.partnerReportMarkedShared]: () => ({ words: "Marked the partner report as shared" }),
  [AUDIT_ACTIONS.accountDeleted]: ({ detail }) => ({ words: readAccountDeletedWords(detail) }),
  [AUDIT_ACTIONS.introAsksAnswered]: ({ detail }) => ({ words: detail === "yes" ? "Takes intro asks" : "Asked not to get intro asks" }),
  [AUDIT_ACTIONS.chatConnected]: ({ detail }) => ({ words: "Connected", target: detail }),
  [AUDIT_ACTIONS.chatChannelChosen]: ({ detail }) => ({ words: "Chose where new asks are posted", target: detail }),
  [AUDIT_ACTIONS.chatPaused]: ({ detail }) => ({ words: "Paused posting", target: detail }),
  [AUDIT_ACTIONS.chatResumed]: ({ detail }) => ({ words: "Turned posting back on", target: detail }),
  [AUDIT_ACTIONS.chatDisconnected]: ({ detail }) => ({ words: "Disconnected, token deleted", target: detail }),
  [AUDIT_ACTIONS.perksSaved]: () => ({ words: "Changed settings: perks" }),
  [AUDIT_ACTIONS.perksRemoved]: () => ({ words: "Removed the perks marketplace" }),
  [AUDIT_ACTIONS.villageSettingsChanged]: ({ detail }) => ({ words: `Changed the Village settings: ${detail}` }),
  [AUDIT_ACTIONS.settingsSaved]: ({ detail }) => ({ words: detail ? `Changed settings: ${readSettingsFieldWords(detail)}` : "Changed settings" }),
  [AUDIT_ACTIONS.mailSettingsSaved]: () => ({ words: "Changed settings: mail" }),
  [AUDIT_ACTIONS.mailDnsChecked]: ({ detail }) => ({ words: "Checked the mail DNS records", target: detail || null }),
};

// Settings' save writes the fields it changed ("name, accent"); the log says them in words.
const SETTINGS_FIELD_WORDS: Record<string, string> = {
  name: "community name",
  descriptor: "descriptor",
  logoUrl: "logo",
  accent: "brand colour",
  fromName: "from name",
  mailDomain: "sending domain",
  hostingBy: "hosted by",
  region: "data region",
  contactName: "data contact",
  contactEmail: "data contact email",
  messagePolicy: "message policy",
  plan: "plan",
  managedSetupBy: "set up by",
};

function readSettingsFieldWords(detail: string) {
  return detail
    .split(", ")
    .map((field) => SETTINGS_FIELD_WORDS[field] ?? field)
    .join(", ");
}

// The detail is "self" or "admin", then what Village said, for example "admin|cancelled". It never names anyone.
function readAccountDeletedWords(detail: string) {
  const [who, village] = detail.split("|");
  const what = who === "self" ? "Deleted their own account and everything it held" : "Deleted a member’s account and everything it held";
  if (village === "cancelled") return `${what}. Village was asked to remove them, and did`;
  if (village === "failed") return `${what}. Village couldn’t be reached to remove them`;
  return what;
}

function readFillInBasisWords(detail: string) {
  if (detail === "off") return "Turned off the profile fill-in";
  if (detail === "ask") return "Profile fill-in: ask each member at sign-in";
  return `Profile fill-in: members agreed in our membership terms on ${detail.replace("terms:", "")}`;
}

function readReplyClause(removedReplyCount: number) {
  if (removedReplyCount === 0) return "";
  return removedReplyCount === 1 ? " and its 1 reply" : ` and its ${removedReplyCount} replies`;
}

export function readAuditLine(entry: AuditEntry): ActionLine {
  const { action, kind, targetName, detail, removedReplyCount } = entry;
  if (kind === AUDIT_KINDS.postDeleted) return { words: `Deleted a post${readReplyClause(removedReplyCount)}`, target: targetName };
  if (kind === AUDIT_KINDS.commentDeleted) return { words: "Deleted a reply", target: targetName };
  if (!action) return { words: kind };
  return ACTION_LINES[action]?.({ target: targetName, detail: detail ?? "" }) ?? { words: action, target: targetName };
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const { actorName, removedText, createdAt } = entry;
  const { words, target } = readAuditLine(entry);
  return (
    <div className="fh-r grid-cols-[minmax(0,1fr)_auto]" data-audit-row>
      <div className="fh-who">
        <b className="fh-plain">
          {words}
          {target ? <span className="fh-muted"> · {target}</span> : null}
        </b>
        <span>{actorName || FORMER_ADMIN}</span>
        {removedText ? (
          <details className="mt-1">
            <summary className="fh-small cursor-pointer font-medium text-fund-deep">See what it said</summary>
            <QuoteBox className="whitespace-pre-wrap wrap-anywhere">{removedText}</QuoteBox>
          </details>
        ) : null}
      </div>
      <div className="fh-end">
        <small>{formatDayMonthTimeUtc(createdAt)}</small>
      </div>
    </div>
  );
}

function AuditRows({ page: requestedPage, onPageChange }: { page: number; onPageChange: (page: number) => void }) {
  const { data } = useSuspenseQuery(auditPageQuery(requestedPage));
  if (data.entries.length === 0) {
    return (
      <div data-slot="empty-state" className="fh-empty">
        <h2 className="fh-h2">Nothing yet</h2>
      </div>
    );
  }
  return (
    <>
      <div className="fh-rows">
        {data.entries.map((entry) => (
          <AuditRow key={entry.id} entry={entry} />
        ))}
      </div>
      <Pagination page={data.page} pageCount={data.pageCount} label="Audit log pages" onPageChange={onPageChange} />
    </>
  );
}

export function AuditLog() {
  const [page, setPage] = useState(1);
  const deferredPage = useDeferredValue(page);
  return (
    <section aria-labelledby={AUDIT_TITLE_ID}>
      <h2 id={AUDIT_TITLE_ID} tabIndex={-1} className="sr-only">
        Admin actions, newest first
      </h2>
      <QueryBoundary loadingMessage="Reading the log…">
        <AuditRows
          page={deferredPage}
          onPageChange={(nextPage) => {
            setPage(nextPage);
            document.getElementById(AUDIT_TITLE_ID)?.focus();
          }}
        />
      </QueryBoundary>
    </section>
  );
}
