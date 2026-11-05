import type { Environment } from "../environment.ts";
import { logError } from "../observability/route-logging.ts";
import { withDeadline } from "../observability/with-deadline.ts";
import { resolveMigrationPlan } from "./migration-plan.ts";
import { runMigrations } from "./run-migrations.ts";

const BOOT_WAIT_MS = 15_000;
const DEFAULT_RETRY_DELAYS = { firstMs: 5_000, maximumMs: 60_000 };
const BACKOFF_FACTOR = 2;

type RetryDelays = typeof DEFAULT_RETRY_DELAYS;
type AfterMigrations = () => Promise<void>;

async function attemptUntilApplied(
  connectionString: string,
  environment: Environment,
  retryDelays: RetryDelays,
  afterMigrations: AfterMigrations,
) {
  try {
    const { migrated } = await runMigrations(connectionString, environment);
    console.log(migrated ? "Migrations applied." : "Migrations already applied.");
    await afterMigrations();
  } catch (error) {
    logError("migrations", error);
    const nextDelays = {
      ...retryDelays,
      firstMs: Math.min(retryDelays.firstMs * BACKOFF_FACTOR, retryDelays.maximumMs),
    };
    const retry = () => attemptUntilApplied(connectionString, environment, nextDelays, afterMigrations);
    setTimeout(retry, retryDelays.firstMs).unref();
  }
}

// DigitalOcean grants `public` rights only after a deploy passes, so a failed attempt must leave
// the server up and keep retrying. /api/health returns 503 until migrations land.
export async function migrateOnBoot(
  environment: Environment,
  retryDelays: RetryDelays = DEFAULT_RETRY_DELAYS,
  afterMigrations: AfterMigrations = async () => undefined,
) {
  try {
    const plan = resolveMigrationPlan(environment);
    if (!plan.shouldRun) {
      console.log(`Skipping migrations. ${plan.reason}`);
      return;
    }
    await withDeadline(
      attemptUntilApplied(plan.connectionString, environment, retryDelays, afterMigrations),
      BOOT_WAIT_MS,
      "Migrations are still running. The server is starting without waiting for them.",
    );
  } catch (error) {
    logError("migrations", error);
  }
}
