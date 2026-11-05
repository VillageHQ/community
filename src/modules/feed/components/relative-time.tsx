import { formatShortDate } from "@/platform/text/format-date";
import { formatRelativeTime } from "@/modules/feed/rules-relative-time";

export function RelativeTime({ timestamp }: { timestamp: string }) {
  return (
    <time dateTime={timestamp} title={formatShortDate(timestamp)} suppressHydrationWarning>
      {formatRelativeTime(timestamp)}
    </time>
  );
}
