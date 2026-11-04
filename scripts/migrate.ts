import { resolveMigrationPlan } from "../src/database/migration-plan.ts";
import { runMigrations } from "../src/database/run-migrations.ts";
import { readErrorReason } from "../src/lib/route-logging.ts";

try {
  const plan = resolveMigrationPlan(process.env);
  if (plan.shouldRun) await runMigrations(plan.connectionString, process.env);
  console.log(plan.shouldRun ? "Migrations are up to date." : `Skipping migrations. ${plan.reason}`);
} catch (error) {
  console.error(`Migrations failed. ${readErrorReason(error)}`);
  process.exit(1);
}
