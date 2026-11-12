import type { Metadata } from "next";

import { PublicPage } from "@/components/public-page";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuoteBox } from "@/components/ui/note";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { API_ROUTES, ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";
import { PLATFORM_MANIFEST } from "@/platform/modules/platform-manifest";
import { readItemAction, WEEKLY_ANSWER_WORDS_FIELD } from "@/platform/weekly-email/ledger";
import { REPLY_CODES } from "@/platform/weekly-email/reply-codes";
import { FACT_FIX_LENGTH } from "@/modules/members/contract-fill-in";
import { readItemToken } from "@/platform/weekly-email/tokens";
import { WEEKLY_ITEM_KINDS } from "@/shell/today";
import { ANSWER_OUTCOMES, readAnswerTarget } from "@/shell/weekly-email-answers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: PAGE_TITLES.weeklyAnswer, robots: { index: false, follow: false } };

type WeeklyAnswerPageProps = { searchParams: Promise<{ token?: string; result?: string }> };

const QUESTIONS: Record<string, { title: string; button: string; done: string }> = {
  [REPLY_CODES.help]: { title: "Offer your help?", button: "Offer help", done: "Your offer is on its way. The asker can see your note." },
  [REPLY_CODES.skip]: { title: "Not for you?", button: "Hide this ask", done: "Done. This ask won't come up for you again." },
  [REPLY_CODES.yes]: { title: "Say yes to this intro?", button: "Yes, I'll introduce", done: "Thanks. Open your intros to send the link to the person you're introducing." },
  [REPLY_CODES.no]: { title: "Say no to this intro?", button: "No thanks", done: "Done. They'll see that it isn't happening this time." },
  // A line filled in from public profiles, in Founderhall's words (digestLinkPage).
  [REPLY_CODES.right]: { title: "Is this right?", button: "Yes, it's right", done: "Thank you. It's marked as right." },
  [REPLY_CODES.hide]: { title: "Hide this line?", button: "Hide it", done: "Hidden. It stays hidden when your profile refreshes." },
  [REPLY_CODES.fix]: { title: "Fix this line", button: "Save", done: "Saved in your own words. They always win." },
};

const FACT_LEDE = "We filled this in from public sources. You decide what shows.";

const PROBLEMS: Record<string, string> = {
  [ANSWER_OUTCOMES.gone]: "This isn't available anymore. It may have closed, or it changed since the email.",
  [ANSWER_OUTCOMES.expired]: "This email is more than three weeks old, so its links have stopped working.",
  [ANSWER_OUTCOMES.noItem]: "This link doesn't match anything in that email.",
  [ANSWER_OUTCOMES.wrongCode]: "This link doesn't match anything in that email.",
  [ANSWER_OUTCOMES.needsWords]: "Write the right words for this line.",
};

// "City: Lisbon" back into its label and its words.
function splitLine(title: string) {
  const at = title.indexOf(": ");
  return at < 0 ? { label: "", value: title } : { label: title.slice(0, at), value: title.slice(at + 2) };
}

function Problem({ message }: { message: string }) {
  return (
    <>
      <h1 className="fh-h2">This link doesn&apos;t work</h1>
      <p className="fh-lede">{message}</p>
    </>
  );
}

async function readPage(token: string) {
  const database = getDatabase();
  const link = await readItemToken(database, process.env, token);
  if (!link) return { problem: "It may be cut short. Open it again from the email." } as const;
  const target = await readAnswerTarget(database, link.weeklyEmailId, link.itemNumber, link.action);
  if (target.outcome || !target.item) return { problem: PROBLEMS[target.outcome ?? ANSWER_OUTCOMES.gone] ?? PROBLEMS.gone ?? "" } as const;
  const earlier = await readItemAction(database, link.weeklyEmailId, link.itemNumber);
  return { problem: null, link, item: target.item, earlier } as const;
}

// Opening the link changes nothing: some mail scanners open every link. Only the button does.
export default modulePage(PLATFORM_MANIFEST, async function WeeklyAnswerPage({ searchParams }: WeeklyAnswerPageProps) {
  const { token = "", result } = await searchParams;
  const [community, page] = await Promise.all([readBrandingForPage(), readPage(token)]);
  const question = page.problem === null ? QUESTIONS[page.link.action] : undefined;

  return (
    <PublicPage community={community}>
      {page.problem !== null || !question ? (
        <Problem message={page.problem ?? "It may be cut short. Open it again from the email."} />
      ) : page.earlier ? (
        <>
          <h1 className="fh-h2">{result === ANSWER_OUTCOMES.done ? "Done" : "Already answered"}</h1>
          <p className="fh-lede">{page.item.title}</p>
          <Alert variant="success" className="mt-4">
            {result === ANSWER_OUTCOMES.done || (!result && page.earlier.action === page.link.action)
              ? (QUESTIONS[page.earlier.action]?.done ?? "Done.")
              : `You already answered this one ${page.earlier.via === "reply" ? "by email" : "from a link"}, so nothing changed.`}
          </Alert>
        </>
      ) : (
        <>
          <h1 className="fh-h2">{question.title}</h1>
          {page.item.kind === WEEKLY_ITEM_KINDS.fact ? (
            <>
              <p className="fh-lede">{FACT_LEDE}</p>
              <QuoteBox className="mt-3">
                <b>{splitLine(page.item.title).label}:</b> {splitLine(page.item.title).value}
              </QuoteBox>
            </>
          ) : (
            <p className="fh-lede">{page.item.title}</p>
          )}
          {result === ANSWER_OUTCOMES.already ? (
            <Alert variant="info" className="mt-4">
              You&apos;d already done this in the app, so nothing changed.
            </Alert>
          ) : result && result !== ANSWER_OUTCOMES.done ? (
            <Alert variant="destructive" className="mt-4">
              {PROBLEMS[result] ?? "That didn't work. Try again from the app."}
            </Alert>
          ) : null}
          <form method="post" action={`${API_ROUTES.weeklyAnswer}?token=${encodeURIComponent(token)}`} className="mt-[18px] grid gap-4">
            {page.link.action === REPLY_CODES.help ? (
              <div className="grid gap-2">
                <Label htmlFor="weekly-answer-words" className="fh-label">A note for the asker (optional)</Label>
                <Textarea id="weekly-answer-words" name={WEEKLY_ANSWER_WORDS_FIELD} maxLength={500} placeholder="How you can help" />
              </div>
            ) : null}
            {page.link.action === REPLY_CODES.fix ? (
              <div className="grid gap-2">
                <Label htmlFor="weekly-answer-words" className="fh-label">Your words</Label>
                <Input id="weekly-answer-words" name={WEEKLY_ANSWER_WORDS_FIELD} maxLength={FACT_FIX_LENGTH} defaultValue={splitLine(page.item.title).value} required />
              </div>
            ) : null}
            <div>
              <Button type="submit" width="block">
                {question.button}
              </Button>
            </div>
          </form>
        </>
      )}
      <p className="fh-small mt-4">
        <a href={ROUTES.feed}>Open {community.name}</a>
      </p>
    </PublicPage>
  );
});
