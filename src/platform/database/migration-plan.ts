import type { Environment } from "../environment.ts";

export type MigrationPlan =
  | { shouldRun: true; connectionString: string }
  | { shouldRun: false; reason: string };

export function isPreviewSharingDatabase(environment: Environment) {
  return environment.VERCEL_ENV === "preview" && environment.MIGRATE_ON_PREVIEW !== "true";
}

export function resolveMigrationPlan(environment: Environment): MigrationPlan {
  if (isPreviewSharingDatabase(environment)) {
    return {
      shouldRun: false,
      reason: "Vercel preview. Set MIGRATE_ON_PREVIEW=true to migrate previews.",
    };
  }

  const connectionString = environment.DATABASE_URL_UNPOOLED || environment.DATABASE_URL;
  if (!connectionString) throw new Error("Set DATABASE_URL or DATABASE_URL_UNPOOLED to migrate.");

  return { shouldRun: true, connectionString };
}
