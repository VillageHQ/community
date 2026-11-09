import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

const MILLISECOND_PRECISION = 3;

function jobTimestamp(name: string) {
  return timestamp(name, { withTimezone: true, precision: MILLISECOND_PRECISION });
}

// One row per timed job. A server runs a job only while it holds the lease, so two servers
// never run the same job at once, and a crashed holder's lease simply runs out.
export const jobLease = pgTable("job_lease", {
  name: text("name").primaryKey(),
  holder: text("holder"),
  leasedUntil: jobTimestamp("leased_until").notNull(),
  lastStartedAt: jobTimestamp("last_started_at"),
  lastFinishedAt: jobTimestamp("last_finished_at"),
  lastError: text("last_error"),
});
