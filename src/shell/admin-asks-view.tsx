import { Hand, Megaphone } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { FlashNote } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { KvTiles } from "@/components/ui/figures";
import { Pill, type PillTone } from "@/components/ui/pill";
import { ASKS_ADMIN_PAGE, ASKS_PAGE } from "@/modules/asks/contract";
import { ROUTES } from "@/platform/http/routes";
import { formatDayMonth } from "@/modules/admin/console-periods";

import { ASK_ROW_STATUSES, describeHours, type AdminAskRow, type AdminAsks, type AskRowStatus, type AsksFigures } from "./admin-asks";
import { AskRowActions, DigestSettingsForm } from "./admin-asks-actions";
import { ReportedAsks } from "./reported-asks";

// What a member reads when there is no ask yet (Founderhall's EMPTY_ASKS).
export const EMPTY_ASKS = "No open asks yet. When a founder needs someone, the ask shows here and in Thursday’s digest.";

// The flash after an action on Asks & digest (?m=…), in Founderhall's words.
export const ASKS_FLASHES: Record<string, string> = {
  pin: "Pinned.",
  unpin: "Unpinned.",
  close: "Closed.",
  remove: "Removed. Members no longer see it.",
  asksettings: "Saved.",
};

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

// Founderhall's "Asks & updates" block: four tiles and one line. The console home shows it with a link here.
export function AsksBlock({ figures, hasLink = true }: { figures: AsksFigures; hasLink?: boolean }) {
  const { open, answered, medianHours, posted, withHelpers, helped, intros, introsMade, updates } = figures;
  return (
    <>
      <div className="fh-sheet-head">
        <h2 className="fh-h3">Asks &amp; updates</h2>
        {hasLink ? <Link href={ASKS_ADMIN_PAGE}>Asks &amp; digest</Link> : null}
      </div>
      <KvTiles
        className="fh-askkv"
        tiles={[
          { value: open, label: "open asks" },
          { value: answered, label: "answered", isGood: true },
          { value: describeHours(medianHours), label: "median time to first help" },
          { value: posted, label: `asks posted${withHelpers ? `, ${withHelpers} with members who can help` : ""}` },
        ]}
      />
      <p className="fh-small fh-muted mt-2.5">
        {helped} asks got an offer of help; {plural(intros, "intro")} started from asks, {introsMade} made. {plural(updates, "update")}.
      </p>
    </>
  );
}

const STATUS_PILLS: Record<AskRowStatus, { tone: PillTone; label: string }> = {
  [ASK_ROW_STATUSES.open]: { tone: "open", label: "Open" },
  [ASK_ROW_STATUSES.answered]: { tone: "made", label: "Answered" },
  [ASK_ROW_STATUSES.closed]: { tone: "declined", label: "Closed" },
  [ASK_ROW_STATUSES.expired]: { tone: "declined", label: "Expired" },
  [ASK_ROW_STATUSES.update]: { tone: "plain", label: "Update" },
};

function AskRow({ row, canPin }: { row: AdminAskRow; canPin: boolean }) {
  const Icon = row.status === ASK_ROW_STATUSES.update ? Megaphone : Hand;
  const pill = STATUS_PILLS[row.status];
  return (
    <div className="fh-r">
      <span>
        <Icon aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} />
      </span>
      <div className="fh-who">
        <b className="fh-plain">
          <Link href={`${ASKS_PAGE}/${row.id}`}>{row.title}</Link>
        </b>
        <span>
          {row.authorName} · {formatDayMonth(new Date(row.createdAt))} · {row.helperCount} can help · {row.answerCount} answers
        </span>
      </div>
      <div className="fh-end">
        <Pill tone={pill.tone}>{pill.label}</Pill>
        <AskRowActions askId={row.id} title={row.title} isPinned={row.isPinned} canPin={row.isPinned || (canPin && (row.status === ASK_ROW_STATUSES.open || row.status === ASK_ROW_STATUSES.update))} canClose={row.canClose && (row.status === ASK_ROW_STATUSES.open || row.status === ASK_ROW_STATUSES.update)} />
      </div>
    </div>
  );
}

type AdminAsksViewProps = AdminAsks & { flash: string | null };

// Asks & digest (Founderhall's): the figures, the weekly digest's settings, every ask and update with Pin / Close /
// Remove, and Community's reported asks when there are any.
export function AdminAsksView({ figures, rows, reported, weeklyAllowance, schedule, isDigestOn, nextDigest, digest, canPin, flash }: AdminAsksViewProps) {
  return (
    <>
      {flash ? <FlashNote>{flash}</FlashNote> : null}
      <PageHeader
        title="Asks & digest"
        description="What members ask, who helps, and the Thursday digest that brings it to their inbox. Names and dates only; members’ answers stay in the portal."
      />
      <div className="fh-grid">
        <section className="fh-sheet fh-c7">
          <AsksBlock figures={figures} hasLink={false} />
        </section>
        <section className="fh-sheet fh-c5">
          <div className="fh-sheet-head">
            <h2 className="fh-h3">The weekly digest</h2>
            <Link href={ROUTES.adminDigest}>Preview</Link>
          </div>
          <p className="fh-small">
            {isDigestOn ? (
              <>
                Next: <b>{nextDigest ?? "–"}</b>.
              </>
            ) : (
              <b>Off.</b>
            )}
            {isDigestOn ? "" : " No digest is sent."} Last 30 days: {digest.sent} sent, {digest.empty} skipped with nothing to answer, {digest.answered} items answered ({digest.byReply} by email reply).
          </p>
          <DigestSettingsForm isEnabled={isDigestOn} schedule={schedule} weeklyAllowance={weeklyAllowance} />
        </section>
        <section className="fh-sheet fh-c12">
          <div className="fh-sheet-head">
            <h2 className="fh-h3">Every ask and update</h2>
            <Link href={ASKS_PAGE}>Members’ view</Link>
          </div>
          {rows.length > 0 ? (
            <div className="fh-rows fh-modrows">
              {rows.map((row) => (
                <AskRow key={row.id} row={row} canPin={canPin} />
              ))}
            </div>
          ) : (
            <EmptyState title="No asks yet" description={EMPTY_ASKS} />
          )}
          <p className="fh-small fh-muted mt-2.5">Pin keeps an open ask at the top. Close ends it for everyone; Remove hides it from members (it stays in the audit log).</p>
        </section>
        {reported.length > 0 ? (
          <section className="fh-sheet fh-c12" aria-labelledby="reported-asks">
            <div className="fh-sheet-head">
              <h2 className="fh-h3" id="reported-asks">
                Reported
              </h2>
              <Link href={ROUTES.adminReports}>Every report</Link>
            </div>
            <p className="fh-small fh-muted">Asks and answers members flagged. The person who posted it isn’t told either way.</p>
            <ReportedAsks reported={reported} />
          </section>
        ) : null}
      </div>
    </>
  );
}
