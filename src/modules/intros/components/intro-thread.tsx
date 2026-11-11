import { readFirstName } from "@/platform/design/avatar-identity";
import { formatDayMonth } from "@/platform/text/format-date";
import { INTRO_THREAD_AUTHORS, type IntroThreadAuthor } from "@/modules/intros/schema";
import type { IntroThreadEntry } from "@/modules/intros/service-thread";

type ThreadNames = { requesterName: string; targetName: string; introducerName: string; viewerAuthor: IntroThreadAuthor };

// The replies to the introduction email, passed on between the asker, the person and the connector (copied). Read here;
// answered by email. Founderhall's thread rows: who and when, then the words.
export function IntroThread({ entries, names }: { entries: readonly IntroThreadEntry[]; names: ThreadNames }) {
  const nameOf: Record<IntroThreadAuthor, string> = {
    [INTRO_THREAD_AUTHORS.requester]: names.requesterName,
    [INTRO_THREAD_AUTHORS.target]: names.targetName,
    [INTRO_THREAD_AUTHORS.introducer]: names.introducerName,
  };
  const others = Object.values(INTRO_THREAD_AUTHORS)
    .filter((author) => author !== names.viewerAuthor)
    .map((author) => readFirstName(nameOf[author]));
  return (
    <section className="fh-section">
      <p className="fh-small fh-muted">Reply to the introduction email to write to {others.join(" and ")}. Replies show here.</p>
      {entries.length === 0 ? (
        <div data-slot="empty-state" className="fh-empty mt-3.5">
          <h2 className="fh-h2">No replies yet</h2>
          <p>Replies to the introduction email show here.</p>
        </div>
      ) : (
        <ol className="fh-rows mt-3.5">
          {entries.map((entry) => (
            <li key={entry.id} className="fh-r">
              <span />
              <span className="fh-who">
                <b>{entry.author === names.viewerAuthor ? "You" : nameOf[entry.author]}</b>
                <span className="whitespace-pre-wrap">{entry.body}</span>
              </span>
              <span className="fh-end">
                <small>{formatDayMonth(entry.createdAt)}</small>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
