import type { Database } from "../database/client.ts";
import type { Environment } from "../environment.ts";

const DEFAULT_ROUTE_DEADLINE_MS = 60_000;

export type SessionMember = { id: string; email: string; role?: string | null };

export type RequestContext = {
  database: Database;
  environment: Environment;
  member: SessionMember;
  deadlineAtMs: number;
};

export function createRequestContext(
  database: Database,
  environment: Environment,
  member: SessionMember,
  deadlineMs = DEFAULT_ROUTE_DEADLINE_MS,
): RequestContext {
  return { database, environment, member, deadlineAtMs: Date.now() + deadlineMs };
}
