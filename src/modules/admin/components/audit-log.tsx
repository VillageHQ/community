"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { QueryBoundary } from "@/components/query-boundary";
import { Avatar } from "@/components/ui/avatar";
import { AUDIT_ACTIONS, type AuditAction } from "@/platform/audit/actions";
import { AUDIT_KINDS, REPORT_TARGETS, type AuditEntry } from "@/modules/admin/contract";
import { GROUP_DEPARTURE_OUTCOMES } from "@/modules/network/contract";
import { formatDateAndTimeUtc } from "@/platform/text/format-date";

import { auditPageQuery } from "@/modules/admin/queries-audit";

const AUDIT_AVATAR_SIZE_PX = 44;
const AUDIT_TITLE_ID = "audit-log-title";
const SOMEONE = "someone";

const REPORT_TARGET_NAMES: Record<string, string> = {
  [REPORT_TARGETS.post]: "post",
  [REPORT_TARGETS.comment]: "reply",
  [REPORT_TARGETS.directMessage]: "direct message",
  [REPORT_TARGETS.introNote]: "intro note",
};

const GROUP_DEPARTURE_SENTENCES: Record<string, (target: string) => string> = {
  [GROUP_DEPARTURE_OUTCOMES.left]: (target) => `took ${target} out of the Village group`,
  [GROUP_DEPARTURE_OUTCOMES.creatorRefused]: (target) => `tried to take ${target} out of the Village group, and Village refused because they created it`,
  [GROUP_DEPARTURE_OUTCOMES.failed]: (target) => `tried to take ${target} out of the Village group, and it didn't work`,
};

function readDepartureSentence(target: string, outcome: string) {
  return GROUP_DEPARTURE_SENTENCES[outcome]?.(target) ?? `tried to take ${target} out of the Village group`;
}

type ActionFacts = { target: string; detail: string };

const ACTION_SENTENCES: Record<AuditAction, (facts: ActionFacts) => string> = {
  [AUDIT_ACTIONS.rolePromoted]: ({ target }) => `made ${target} an admin`,
  [AUDIT_ACTIONS.roleDemoted]: ({ target }) => `removed ${target}'s admin role`,
  [AUDIT_ACTIONS.memberRemoved]: ({ target, detail }) => `removed ${target}. ${detail}`,
  [AUDIT_ACTIONS.memberUnbanned]: ({ target }) => `unbanned ${target}`,
  [AUDIT_ACTIONS.emailConfirmed]: ({ target }) => `approved ${target}'s email`,
  [AUDIT_ACTIONS.villageLinkApproved]: ({ target, detail }) => `approved the Village account ${detail} for ${target}`,
  [AUDIT_ACTIONS.villageLinkReset]: ({ target }) => `reset ${target}'s Village link`,
  [AUDIT_ACTIONS.linkedinConfirmed]: ({ target }) => `confirmed ${target}'s LinkedIn`,
  [AUDIT_ACTIONS.linkedinCleared]: ({ target }) => `cleared ${target}'s LinkedIn`,
  [AUDIT_ACTIONS.inviteCreated]: ({ target }) => `invited ${target}`,
  [AUDIT_ACTIONS.inviteResent]: ({ target }) => `made a new invite link for ${target}`,
  [AUDIT_ACTIONS.inviteRevoked]: ({ target }) => `revoked the invite for ${target}`,
  [AUDIT_ACTIONS.inviteReclaimed]: ({ target, detail }) => `locked ${target}'s account and made a new invite for ${detail}`,
  [AUDIT_ACTIONS.reportDismissed]: ({ target, detail }) => `dismissed a report on a ${REPORT_TARGET_NAMES[detail] ?? "message"} by ${target}`,
  [AUDIT_ACTIONS.reportedContentDeleted]: ({ target, detail }) => `deleted a reported ${REPORT_TARGET_NAMES[detail] ?? "message"} by ${target}`,
  [AUDIT_ACTIONS.postPinned]: ({ target }) => `pinned a post by ${target}`,
  [AUDIT_ACTIONS.postUnpinned]: ({ target }) => `unpinned a post by ${target}`,
  [AUDIT_ACTIONS.dailyLimitChanged]: ({ detail }) => `set the daily limit to ${detail} lookups per member`,
  [AUDIT_ACTIONS.villageKeysSaved]: () => "saved new Village keys",
  [AUDIT_ACTIONS.villageGroupCreated]: ({ detail }) => `created the Village group "${detail}"`,
  [AUDIT_ACTIONS.brandingSaved]: () => "changed the community's brand",
  [AUDIT_ACTIONS.logoSaved]: () => "changed the community's logo",
  [AUDIT_ACTIONS.logoRemoved]: () => "removed the community's logo",
  [AUDIT_ACTIONS.villageGroupLeft]: ({ target, detail }) => readDepartureSentence(target, detail),
  [AUDIT_ACTIONS.memberReinvited]: ({ target, detail }) => `invited ${target} back as a new account, at ${detail}`,
  [AUDIT_ACTIONS.passwordReset]: () => "reset their own password by email",
  [AUDIT_ACTIONS.adminPasswordRecovered]: () => "recovered their admin password with the setup token",
  [AUDIT_ACTIONS.moduleTurnedOn]: ({ detail }) => `turned on ${detail}`,
  [AUDIT_ACTIONS.moduleTurnedOff]: ({ detail }) => `turned off ${detail}`,
  [AUDIT_ACTIONS.domainConfirmed]: ({ detail }) => `confirmed the domain ${detail} in Village`,
};

function readReplyClause(removedReplyCount: number) {
  if (removedReplyCount === 0) return "";
  return removedReplyCount === 1 ? " and its 1 reply" : ` and its ${removedReplyCount} replies`;
}

const DELETION_SENTENCES: Record<string, (entry: AuditEntry) => string> = {
  [AUDIT_KINDS.postDeleted]: ({ targetName, removedReplyCount }) => `deleted a post by ${targetName ?? SOMEONE}${readReplyClause(removedReplyCount)}`,
  [AUDIT_KINDS.commentDeleted]: ({ targetName }) => `deleted a reply by ${targetName ?? SOMEONE}`,
};

function readSentence(entry: AuditEntry) {
  const { action, kind, targetName, detail } = entry;
  if (!action) return DELETION_SENTENCES[kind]?.(entry) ?? "";
  return ACTION_SENTENCES[action]({ target: targetName ?? SOMEONE, detail: detail ?? "" });
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const { actorId, actorName, removedText, createdAt } = entry;
  return (
    <li className="flex items-start gap-3.5 rounded-card-phone bg-card p-4 shadow-panel sm:rounded-card sm:px-5">
      <Avatar stableId={actorId ?? actorName} name={actorName} sizePx={AUDIT_AVATAR_SIZE_PX} />
      <div className="grid min-w-0 flex-1 gap-1.5">
        <p className="wrap-anywhere">
          <strong className="font-bold">{actorName || "A former admin"}</strong> {readSentence(entry)}
        </p>
        <p className="type-small text-muted-foreground">{formatDateAndTimeUtc(createdAt)}</p>
        {removedText ? (
          <details className="group">
            <summary className="type-small inline-flex min-h-11 cursor-pointer items-center font-bold text-brand-emphasis underline underline-offset-3">
              See what it said
            </summary>
            <blockquote className="type-small mt-1 rounded-field bg-muted p-3.5 wrap-anywhere whitespace-pre-wrap text-foreground">{removedText}</blockquote>
          </details>
        ) : null}
      </div>
    </li>
  );
}

function AuditRows({ page: requestedPage, onPageChange }: { page: number; onPageChange: (page: number) => void }) {
  const { data } = useSuspenseQuery(auditPageQuery(requestedPage));
  if (data.entries.length === 0) {
    return (
      <div className="rounded-panel bg-card shadow-panel">
        <EmptyState icon={ScrollText} title="Nothing here yet" description="Each admin action shows up here: who did what, and when." headingLevel="h3" />
      </div>
    );
  }
  return (
    <>
      <ul className="grid gap-2.5">
        {data.entries.map((entry) => (
          <AuditRow key={entry.id} entry={entry} />
        ))}
      </ul>
      <Pagination page={data.page} pageCount={data.pageCount} label="Audit log pages" onPageChange={onPageChange} />
    </>
  );
}

export function AuditLog() {
  const [page, setPage] = useState(1);
  const deferredPage = useDeferredValue(page);
  return (
    <section aria-labelledby={AUDIT_TITLE_ID} className="grid gap-3.5">
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
