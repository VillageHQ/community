import { formatShortDate } from "@/platform/text/format-date";
import { formatRelativeTime } from "@/lib/feed/relative-time";

export function RelativeTime({ timestamp }: { timestamp: string }) {
  return (
    <time dateTime={timestamp} title={formatShortDate(timestamp)} suppressHydrationWarning>
      {formatRelativeTime(timestamp)}
    </time>
  );
}
