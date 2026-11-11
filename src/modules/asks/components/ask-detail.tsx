import { Hand, Pin } from "lucide-react";
import Link from "next/link";

import { FlashNote } from "@/components/flash";
import { BackLink } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";

import { ASK_ANSWER_KINDS, ASK_KINDS, ASK_STATES, describeAgo, describeAnswerCount, describeCanHelp, describeHelperLine, ASKS_PAGE, type AskMember } from "../contract";
import type { AskDetail as AskDetailData, PostAnswer, PostHelper } from "../reads-board";
import { AnswerForm, AskViaButton, HelpForm, RenewButton, ReportLink, StatusButtons } from "./ask-detail-forms";
import { AskConsent, CompanyMark, describeAbout, ICON, MemberAvatar, PostStatusPill } from "./post-parts";

const ANSWER_KIND_LABELS: Record<string, string | null> = {
  [ASK_ANSWER_KINDS.knowSomeone]: "Knows someone",
  [ASK_ANSWER_KINDS.doneMyself]: "Has done this",
  [ASK_ANSWER_KINDS.answer]: null,
};

const FULL_AVATAR_PX = 36;

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

function memberHref(id: string) {
  return `/members/${id}`;
}

function Warmth({ warmth }: { warmth: string | null }) {
  if (!warmth) return null;
  return (
    <>
      {" "}
      <span className={warmth === "met" ? "fh-warm fh-met" : "fh-warm"}>{`${warmth.charAt(0).toUpperCase()}${warmth.slice(1)}`}</span>
    </>
  );
}

type HelperRowProps = { helper: PostHelper; viewer: AskMember; viewerId: string; isOwn: boolean; isOpen: boolean; askId: string; offeredKind: string | null };

// Founderhall's helperRow: the member, how they could help, and on your own open ask the intro and message buttons.
function HelperRow({ helper, viewer, viewerId, isOwn, isOpen, askId, offeredKind }: HelperRowProps) {
  const { member } = helper;
  const line = describeHelperLine(helper);
  const offeredLabel = offeredKind ? ANSWER_KIND_LABELS[offeredKind] : null;
  const isPath = line.knows !== null;
  return (
    <article className="fh-result fh-helper">
      <div className="fh-top">
        <Avatar stableId={member.id} name={member.name} imageUrl={member.avatarUrl} sizePx={FULL_AVATAR_PX} />
        <div className="fh-who">
          <Link href={memberHref(member.id)}>
            <span className="fh-name">{member.name}</span>
          </Link>
          <p>
            <CompanyMark url={member.companyLogoUrl} />
            {describeAbout(member)}
          </p>
        </div>
        {offeredLabel ? <Pill tone="made">{offeredLabel}</Pill> : null}
      </div>
      {isPath && isOwn && line.knows ? (
        <div className="fh-path" aria-hidden="true">
          <MemberAvatar member={viewer} />
          <span className="fh-seg-line" />
          <MemberAvatar member={member} />
          <span className={helper.warmth === "met" ? "fh-seg-line fh-dash" : "fh-seg-line"} />
          <Avatar stableId={line.knows} name={line.knows} sizePx={28} isOutside />
        </div>
      ) : null}
      <p className="fh-pathtext">
        {isPath ? (
          <>
            Knows <b>{line.knows}</b>
            {line.title ? ` (${line.title})` : ""}
            {helper.why && member.id === viewerId ? ` · ${helper.why}` : ""}
            <Warmth warmth={helper.warmth} />
          </>
        ) : (
          line.title
        )}
      </p>
      {isOwn && isOpen ? (
        <div className="fh-btn-row">
          <AskViaButton askId={askId} helper={{ id: member.id, firstName: firstName(member.name) }} canAsk={helper.canAskForIntro} />
          <Link className="fh-btn fh-btn-quiet fh-btn-sm" href={`/messages/new?to=${member.id}`}>
            Message
          </Link>
        </div>
      ) : null}
    </article>
  );
}

function AnswerRow({ answer, now, canReport }: { answer: PostAnswer; now: Date; canReport: boolean }) {
  const label = ANSWER_KIND_LABELS[answer.kind];
  return (
    <div className="fh-comment" id={`c-${answer.id}`}>
      <div className="fh-ch">
        <MemberAvatar member={answer.author} />
        <div>
          <b>{answer.author.name}</b> {label ? <Pill tone="made">{label}</Pill> : null}
          <small> {describeAgo(answer.createdAt, now)}</small>
        </div>
      </div>
      <p>{answer.body}</p>
      {canReport ? <ReportLink target="answer" id={answer.id} noun="answer" /> : null}
    </div>
  );
}

type AskDetailProps = {
  detail: AskDetailData;
  viewer: AskMember;
  isViewerAdmin: boolean;
  flash: string | null;
  now: Date;
};

// Founderhall's one ask (postPage): back link, the ask, who can help, the answers and the reply box; "I can help" or
// the owner's box in the right rail.
export function AskDetail({ detail, viewer, isViewerAdmin, flash, now }: AskDetailProps) {
  const { post, helpers, privateOffers } = detail;
  const answers = [...detail.answers, ...privateOffers].toSorted((first, second) => first.createdAt.localeCompare(second.createdAt));
  const isOwn = post.isMine;
  const isAsk = post.kind === ASK_KINDS.ask;
  const isOpen = post.state === ASK_STATES.open;
  const who = post.who;
  const offeredBy = new Map(detail.answers.filter(({ kind }) => kind !== ASK_ANSWER_KINDS.answer).map(({ author, kind }) => [author.id, kind]));
  const viewerHelper = helpers.find(({ member }) => member.id === viewer.id) ?? null;
  const pinned = post.isPinned;
  const privateIds = new Set(privateOffers.map(({ id }) => id));
  return (
    <>
      {flash ? <FlashNote>{flash}</FlashNote> : null}
      <BackLink href={ASKS_PAGE}>All asks</BackLink>
      <div className="fh-asks-grid">
        <div>
          <div className="fh-ph fh-askhead">
            <MemberAvatar member={post.author} />
            <b>{post.author.name}</b>
            <span>
              <CompanyMark url={post.author.companyLogoUrl} />
              {[describeAbout(post.author), describeAgo(post.createdAt, now)].filter(Boolean).join(" · ")}
            </span>
          </div>
          <h1 className="fh-askbody">{post.body}</h1>
          <div className="fh-tags" style={{ marginTop: 12 }}>
            <PostStatusPill kind={post.kind} state={post.state} />
            {post.targetCompany ? <span className="fh-tag">{post.targetCompany}</span> : null}
            {post.targetText ? <span className="fh-tag">{post.targetText}</span> : null}
            {pinned ? (
              <span className="fh-tag">
                <Pin {...ICON} />
                Pinned
              </span>
            ) : null}
          </div>
          <StatusButtons askId={post.id} isOwn={isOwn} isAsk={isAsk} isOpen={isOpen} isAdmin={isViewerAdmin} isPinned={pinned} />
          {isOwn && detail.canRenew ? (
            <div className="fh-btn-row" style={{ marginTop: 8 }}>
              <RenewButton askId={post.id} />
            </div>
          ) : null}
          {isAsk ? (
            <section className="fh-section">
              <h2 className="fh-h2">{helpers.length > 0 ? describeCanHelp(helpers.length) : "Nobody found yet"}</h2>
              <div className="fh-rule" style={{ margin: "12px 0 0" }} />
              {helpers.length > 0 ? (
                helpers.map((helper) => (
                  <HelperRow
                    key={helper.member.id}
                    helper={helper}
                    viewer={viewer}
                    viewerId={viewer.id}
                    isOwn={isOwn}
                    isOpen={isOpen}
                    askId={post.id}
                    offeredKind={offeredBy.get(helper.member.id) ?? null}
                  />
                ))
              ) : (
                <p className="fh-small" style={{ marginTop: 12 }}>
                  No member has a path to {who || "them"} yet, and no profile fits. The ask still goes into Thursday’s digest, and anyone can answer below.
                </p>
              )}
              <p className="fh-small fh-muted">Paths come only from members who agreed to share their network. Nobody else is named.</p>
            </section>
          ) : null}
          <section className="fh-section" id="answers">
            <h2 className="fh-h2">{answers.length > 0 ? describeAnswerCount(answers.length) : "No answers yet"}</h2>
            {answers.length > 0 ? (
              <div className="fh-comments">
                {answers.map((answer) => (
                  <AnswerRow key={answer.id} answer={answer} now={now} canReport={!answer.isMine && !privateIds.has(answer.id)} />
                ))}
              </div>
            ) : null}
            <AnswerForm askId={post.id} />
          </section>
          {isOwn ? null : (
            <p style={{ marginTop: 16 }}>
              <ReportLink target="ask" id={post.id} noun={isAsk ? "ask" : "update"} />
            </p>
          )}
        </div>
        <aside>
          {!isOwn && isOpen && isAsk ? (
            <section className="fh-sheet fh-helpbox" id="help">
              <h2 className="fh-h3">
                <Hand aria-hidden="true" className="fh-i fh-s inline-block align-[-3px]" strokeWidth={1.5} /> I can help
              </h2>
              {post.viewerWhyYou && viewerHelper ? (
                <p className="fh-small" style={{ marginTop: 6 }}>
                  <b>Why you:</b> {post.viewerWhyYou}
                </p>
              ) : null}
              <HelpForm askId={post.id} authorFirstName={firstName(post.author.name)} defaultPerson={viewerHelper?.personName ?? ""} />
            </section>
          ) : null}
          {isOwn && isAsk ? (
            <section className="fh-sheet">
              <h2 className="fh-h3">Your ask</h2>
              <p className="fh-small" style={{ marginTop: 6 }}>
                {helpers.length > 0
                  ? `${helpers.length} member${helpers.length === 1 ? " was" : "s were"} told by email, and see it on their Today page.`
                  : "It goes into Thursday’s digest."}{" "}
                When it’s solved, mark it answered: it stays in the archive.
              </p>
              <AskConsent />
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
