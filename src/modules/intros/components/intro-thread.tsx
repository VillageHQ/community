import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { readFirstName } from "@/platform/design/avatar-identity";
import { formatShortDate } from "@/platform/text/format-date";
import { INTRO_THREAD_AUTHORS } from "@/modules/intros/schema";
import type { IntroThreadEntry } from "@/modules/intros/service-thread";

// The replies between the asker and the person they met, passed on by email. Read here; answered by email.
export function IntroThread({ entries, targetName }: { entries: readonly IntroThreadEntry[]; targetName: string }) {
  const targetFirst = readFirstName(targetName);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your conversation with {targetFirst}</CardTitle>
        <CardDescription>Reply to the introduction email to write to {targetFirst}. We pass replies on both ways.</CardDescription>
      </CardHeader>
      {entries.length === 0 ? (
        <p className="type-small mt-4 text-foreground-soft">No replies yet.</p>
      ) : (
        <ol className="mt-4 grid gap-3">
          {entries.map((entry) => (
            <li key={entry.id} className="grid gap-1 rounded-lg border border-border p-3">
              <p className="type-small font-bold text-foreground">
                {entry.author === INTRO_THREAD_AUTHORS.requester ? "You" : targetFirst}
                <span className="font-normal text-foreground-soft"> · {formatShortDate(entry.createdAt)}</span>
              </p>
              <p className="whitespace-pre-wrap break-words text-foreground">{entry.body}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
