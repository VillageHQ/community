import { Hand, MessageSquare, Pin, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";

import { ASK_CONSENT, ASK_KINDS, ASK_STATES, describeAgo, describeAnswerCount, describeCanHelp, toAskPage, type AskMember } from "../contract";
import type { BoardPost } from "../reads-board";

// Founderhall's ask parts (`.post`, the helpers strip, the status pill), shared by the board, the ask's page and Today.
export const ICON = { "aria-hidden": true, className: "fh-i fh-xs", strokeWidth: 1.5 } as const;

const SMALL_AVATAR_PX = 28;

export function MemberAvatar({ member, sizePx = SMALL_AVATAR_PX }: { member: Pick<AskMember, "id" | "name" | "avatarUrl">; sizePx?: number }) {
  return <Avatar stableId={member.id} name={member.name} imageUrl={member.avatarUrl} sizePx={sizePx} />;
}

// The company's logo mark before the role (Founderhall's logo()).
export function CompanyMark({ url }: { url: string | null }) {
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- a small remote logo, as Founderhall draws it
  return <img className="fh-colog inline-block" src={url} alt="" loading="lazy" referrerPolicy="no-referrer" />;
}

// "Founder & CEO, Kilnworks"
export function describeAbout(member: Pick<AskMember, "title" | "company">) {
  return [member.title, member.company].filter(Boolean).join(", ");
}

export function PostStatusPill({ kind, state }: { kind: string; state: BoardPost["state"] }) {
  if (kind === ASK_KINDS.update) return <Pill tone="plain">Update</Pill>;
  if (state === ASK_STATES.closed) return <Pill tone="made">Answered</Pill>;
  if (state === ASK_STATES.expired) return <Pill tone="declined">Closed</Pill>;
  return <Pill tone="open">Open</Pill>;
}

export function TargetLine({ who }: { who: string }) {
  if (!who) return null;
  return (
    <p className="fh-target">
      <Search {...ICON} />
      Trying to reach: {who}
    </p>
  );
}

// One ask in a list (Founderhall's postCard).
export function PostCard({ post, now, isYoursTab = false }: { post: BoardPost; now: Date; isYoursTab?: boolean }) {
  const page = toAskPage(post.id);
  const isAsk = post.kind === ASK_KINDS.ask;
  const isOpen = post.state === ASK_STATES.open;
  const showsHelpers = isAsk && post.helperCount > 0;
  const viewerCanHelp = post.viewerWhyYou !== null && isOpen && !post.viewerHasHelped;
  return (
    <article className="fh-post" id={`post-${post.id}`}>
      <div className="fh-ph">
        <MemberAvatar member={post.author} />
        <div>
          <b>{post.author.name}</b>
          <span>
            <CompanyMark url={post.author.companyLogoUrl} />
            {[describeAbout(post.author), describeAgo(post.createdAt, now)].filter(Boolean).join(" · ")}
          </span>
        </div>
        {post.isPinned ? (
          <span className="fh-pinmark">
            <Pin {...ICON} />
            Pinned
          </span>
        ) : null}
        <PostStatusPill kind={post.kind} state={post.state} />
      </div>
      <p className="fh-body">
        <Link href={page}>{post.body}</Link>
      </p>
      {isAsk ? <TargetLine who={post.who} /> : null}
      {showsHelpers ? (
        <div className="fh-helpers">
          <span className="fh-stack">
            <AvatarStack people={post.helperFaces.map(({ id, name, avatarUrl }) => ({ id, name, imageUrl: avatarUrl }))} />
          </span>
          <span>
            {post.viewerWhyYou !== null ? (
              <>
                <b>You could help.</b> {post.viewerWhyYou}
              </>
            ) : (
              <>
                <b>{describeCanHelp(post.helperCount)}</b>
                {post.pathHelperCount > 0 ? ` · ${post.pathHelperCount} through a warm path` : ""}
              </>
            )}
          </span>
          {viewerCanHelp ? (
            <Link className="fh-btn fh-btn-primary fh-btn-sm" href={`${page}#help`}>
              <Hand {...ICON} />I can help
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className="fh-acts">
        <Link className="fh-react" href={`${page}#answers`}>
          <MessageSquare {...ICON} />
          <span className="underline">{describeAnswerCount(post.answerCount)}</span>
        </Link>
        {isYoursTab && isAsk && isOpen ? (
          <Link className="fh-react" href={page}>
            Mark answered
          </Link>
        ) : null}
      </div>
    </article>
  );
}

// Founderhall's consent line as asks draw it: small, 12 px under what comes before.
export function AskConsent({ children = ASK_CONSENT }: { children?: string }) {
  return (
    <p className="fh-consent fh-small" style={{ marginTop: 12 }}>
      <ShieldCheck aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} />
      <span>{children}</span>
    </p>
  );
}
